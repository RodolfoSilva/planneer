import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db";
import { wbs, schedules } from "../db/schema";
import { auth } from "../auth";
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../lib/errors";
import { getUserOrganizations } from "../services/organization";

// Helper to get authenticated user
async function getAuthUser(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new UnauthorizedError("Authentication required");
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

export const wbsRoutes = new Elysia({ prefix: "/api/wbs" })
  .get(
    "/schedule/:scheduleId",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      
      // Get schedule with project to check access
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.scheduleId),
        with: {
          project: {
            with: { organization: true },
          },
        },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", params.scheduleId);
      }

      // Check if user has access to the schedule's organization
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this schedule");
      }

      // Get all WBS items for this schedule, ordered by sortOrder
      const wbsItems = await db.query.wbs.findMany({
        where: eq(wbs.scheduleId, params.scheduleId),
        orderBy: [asc(wbs.sortOrder), asc(wbs.code)],
        with: {
          children: {
            orderBy: (wbs, { asc }) => [asc(wbs.sortOrder), asc(wbs.code)],
          },
          activities: {
            orderBy: (activities, { asc }) => [asc(activities.code)],
          },
        },
      });

      return { success: true, data: wbsItems };
    },
    {
      params: t.Object({
        scheduleId: t.String(),
      }),
    }
  )
  .post(
    "/",
    async ({ body, request }) => {
      const user = await getAuthUser(request);
      
      // Get schedule with project to check access
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, body.scheduleId),
        with: {
          project: {
            with: { organization: true },
          },
        },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", body.scheduleId);
      }

      // Check if user has access to the schedule's organization
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this schedule");
      }

      // If parentId is provided, validate it exists and belongs to the same schedule
      if (body.parentId) {
        const parent = await db.query.wbs.findFirst({
          where: and(
            eq(wbs.id, body.parentId),
            eq(wbs.scheduleId, body.scheduleId)
          ),
        });

        if (!parent) {
          throw new NotFoundError("Parent WBS", body.parentId);
        }
      }

      // Calculate level based on parent
      let level = 1;
      if (body.parentId) {
        const parent = await db.query.wbs.findFirst({
          where: eq(wbs.id, body.parentId),
        });
        level = parent ? parent.level + 1 : 1;
      }

      // Get max sortOrder for siblings (same parent)
      const siblings = await db.query.wbs.findMany({
        where: and(
          eq(wbs.scheduleId, body.scheduleId),
          body.parentId ? eq(wbs.parentId, body.parentId) : eq(wbs.parentId, null)
        ),
        orderBy: [asc(wbs.sortOrder)],
      });

      const sortOrder = siblings.length > 0 
        ? Math.max(...siblings.map(s => s.sortOrder)) + 1 
        : 0;

      const id = nanoid();
      const now = new Date();

      await db.insert(wbs).values({
        id,
        scheduleId: body.scheduleId,
        parentId: body.parentId || null,
        code: body.code,
        name: body.name,
        level,
        sortOrder,
        createdAt: now,
      });

      const created = await db.query.wbs.findFirst({
        where: eq(wbs.id, id),
        with: {
          children: true,
          activities: true,
        },
      });

      return { success: true, data: created };
    },
    {
      body: t.Object({
        scheduleId: t.String(),
        parentId: t.Optional(t.String()),
        code: t.String({ minLength: 1, maxLength: 50 }),
        name: t.String({ minLength: 1, maxLength: 255 }),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      
      // Get WBS item with schedule to check access
      const wbsItem = await db.query.wbs.findFirst({
        where: eq(wbs.id, params.id),
        with: {
          schedule: {
            with: {
              project: {
                with: { organization: true },
              },
            },
          },
        },
      });

      if (!wbsItem) {
        throw new NotFoundError("WBS", params.id);
      }

      // Check if user has access to the schedule's organization
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === wbsItem.schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this WBS");
      }

      // Prepare update data
      const updateData: any = {};

      if (body.code !== undefined) {
        updateData.code = body.code;
      }
      if (body.name !== undefined) {
        updateData.name = body.name;
      }
      if (body.parentId !== undefined) {
        // If changing parent, validate the new parent exists and belongs to same schedule
        if (body.parentId !== null) {
          const newParent = await db.query.wbs.findFirst({
            where: and(
              eq(wbs.id, body.parentId),
              eq(wbs.scheduleId, wbsItem.scheduleId)
            ),
          });

          if (!newParent) {
            throw new NotFoundError("Parent WBS", body.parentId);
          }

          // Prevent circular reference (can't make a parent its own descendant)
          const checkCircular = async (parentId: string | null, currentId: string): Promise<boolean> => {
            if (!parentId) return false;
            if (parentId === currentId) return true;
            const parent = await db.query.wbs.findFirst({
              where: eq(wbs.id, parentId),
            });
            return parent ? await checkCircular(parent.parentId, currentId) : false;
          };

          if (await checkCircular(body.parentId, params.id)) {
            throw new Error("Cannot set parent: would create circular reference");
          }

          // Calculate new level
          updateData.level = newParent.level + 1;
        } else {
          updateData.level = 1;
        }
        updateData.parentId = body.parentId;
      }
      if (body.sortOrder !== undefined) {
        updateData.sortOrder = body.sortOrder;
      }

      // Update the WBS item
      await db
        .update(wbs)
        .set(updateData)
        .where(eq(wbs.id, params.id));

      // Fetch updated WBS with relations
      const updated = await db.query.wbs.findFirst({
        where: eq(wbs.id, params.id),
        with: {
          children: true,
          activities: true,
        },
      });

      return { success: true, data: updated };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        code: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        parentId: t.Optional(t.Union([t.String(), t.Null()])),
        sortOrder: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      
      // Get WBS item with schedule to check access
      const wbsItem = await db.query.wbs.findFirst({
        where: eq(wbs.id, params.id),
        with: {
          schedule: {
            with: {
              project: {
                with: { organization: true },
              },
            },
          },
          children: true,
          activities: true,
        },
      });

      if (!wbsItem) {
        throw new NotFoundError("WBS", params.id);
      }

      // Check if user has access to the schedule's organization
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === wbsItem.schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this WBS");
      }

      // Check if WBS has children or activities
      if (wbsItem.children && wbsItem.children.length > 0) {
        throw new Error("Cannot delete WBS item that has child WBS items. Please delete or move children first.");
      }

      if (wbsItem.activities && wbsItem.activities.length > 0) {
        throw new Error("Cannot delete WBS item that has activities. Please move or delete activities first.");
      }

      // Delete the WBS item
      await db.delete(wbs).where(eq(wbs.id, params.id));

      return { success: true, data: { deleted: true } };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );

