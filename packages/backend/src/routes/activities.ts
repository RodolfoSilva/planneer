import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { activities, schedules } from "../db/schema";
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

export const activityRoutes = new Elysia({ prefix: "/api/activities" })
  .patch(
    "/:id",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      
      // Get the activity with its schedule
      const activity = await db.query.activities.findFirst({
        where: eq(activities.id, params.id),
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

      if (!activity) {
        throw new NotFoundError("Activity", params.id);
      }

      // Check if user has access to the schedule's organization
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === activity.schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this activity");
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) {
        updateData.name = body.name;
      }
      if (body.description !== undefined) {
        updateData.description = body.description;
      }
      if (body.code !== undefined) {
        updateData.code = body.code;
      }
      if (body.duration !== undefined) {
        updateData.duration = body.duration;
      }
      if (body.durationUnit !== undefined) {
        updateData.durationUnit = body.durationUnit;
      }
      if (body.startDate !== undefined) {
        updateData.startDate = body.startDate || null;
      }
      if (body.endDate !== undefined) {
        updateData.endDate = body.endDate || null;
      }
      if (body.actualStart !== undefined) {
        updateData.actualStart = body.actualStart || null;
      }
      if (body.actualEnd !== undefined) {
        updateData.actualEnd = body.actualEnd || null;
      }
      if (body.percentComplete !== undefined) {
        updateData.percentComplete = Math.max(0, Math.min(100, body.percentComplete));
      }
      if (body.activityType !== undefined) {
        updateData.activityType = body.activityType;
      }
      if (body.wbsId !== undefined) {
        // Validate WBS exists and belongs to the same schedule
        if (body.wbsId !== null) {
          const wbsItem = await db.query.wbs.findFirst({
            where: (wbs, { eq, and }) => and(
              eq(wbs.id, body.wbsId),
              eq(wbs.scheduleId, activity.scheduleId)
            ),
          });
          if (!wbsItem) {
            throw new NotFoundError("WBS", body.wbsId);
          }
        }
        updateData.wbsId = body.wbsId;
      }

      // Update the activity
      await db
        .update(activities)
        .set(updateData)
        .where(eq(activities.id, params.id));

      // Fetch updated activity with relations
      const updated = await db.query.activities.findFirst({
        where: eq(activities.id, params.id),
        with: {
          wbs: true,
          schedule: {
            with: { project: true },
          },
        },
      });

      return { success: true, data: updated };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
        description: t.Optional(t.String()),
        code: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        duration: t.Optional(t.Number({ minimum: 0 })),
        durationUnit: t.Optional(
          t.Union([
            t.Literal("hours"),
            t.Literal("days"),
            t.Literal("weeks"),
            t.Literal("months"),
          ])
        ),
        startDate: t.Optional(t.Union([t.String(), t.Null()])),
        endDate: t.Optional(t.Union([t.String(), t.Null()])),
        actualStart: t.Optional(t.Union([t.String(), t.Null()])),
        actualEnd: t.Optional(t.Union([t.String(), t.Null()])),
        percentComplete: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        activityType: t.Optional(
          t.Union([
            t.Literal("task"),
            t.Literal("milestone"),
            t.Literal("summary"),
            t.Literal("start_milestone"),
            t.Literal("finish_milestone"),
          ])
        ),
        wbsId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  );

