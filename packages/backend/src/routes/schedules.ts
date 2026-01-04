import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { schedules } from "../db/schema";
import { auth } from "../auth";
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../lib/errors";
import { getUserOrganizations } from "../services/organization";
import {
  generateXER,
  generateAndUploadXER,
} from "../services/export/xer-generator";
import { generateXML } from "../services/export/xml-generator";
import { getSignedDownloadUrl, deleteFile } from "../services/storage";

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

export const scheduleRoutes = new Elysia({ prefix: "/api/schedules" })
  .get(
    "/",
    async ({ query, request }) => {
      const user = await getAuthUser(request);
      const { projectId } = query;

      const result = await db.query.schedules.findMany({
        where: projectId ? eq(schedules.projectId, projectId) : undefined,
        orderBy: [desc(schedules.updatedAt)],
        with: {
          project: {
            with: { organization: true },
          },
        },
      });

      const userOrgs = await getUserOrganizations(user.id);
      const orgIds = new Set(userOrgs.map((o) => o.organizationId));

      const filtered = result.filter((s) =>
        orgIds.has(s.project.organizationId)
      );

      return {
        success: true,
        data: {
          items: filtered,
          total: filtered.length,
        },
      };
    },
    {
      query: t.Object({
        projectId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.id),
        with: {
          project: {
            with: { organization: true },
          },
          activities: {
            with: {
              wbs: true,
              predecessors: true,
              resourceAssignments: {
                with: { resource: true },
              },
            },
            orderBy: (activities, { asc }) => [asc(activities.code)],
          },
          wbsItems: {
            orderBy: (wbs, { asc }) => [asc(wbs.sortOrder)],
          },
        },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this schedule");
      }

      return { success: true, data: schedule };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post(
    "/",
    async ({ body, request }) => {
      const user = await getAuthUser(request);
      const project = await db.query.projects.findFirst({
        where: (projects, { eq }) => eq(projects.id, body.projectId),
        with: { organization: true },
      });

      if (!project) {
        throw new NotFoundError("Project", body.projectId);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this project");
      }

      const id = nanoid();
      const now = new Date();

      await db.insert(schedules).values({
        id,
        projectId: body.projectId,
        name: body.name,
        description: body.description,
        startDate: body.startDate,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, id),
        with: { project: true },
      });

      return { success: true, data: schedule };
    },
    {
      body: t.Object({
        projectId: t.String(),
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.id),
        with: { project: true },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this schedule");
      }

      await db
        .update(schedules)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, params.id));

      const updated = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.id),
        with: { project: true },
      });

      return { success: true, data: updated };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("active"),
            t.Literal("completed"),
            t.Literal("archived"),
          ])
        ),
      }),
    }
  )
  .post(
    "/:id/export",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.id),
        with: {
          project: {
            with: { organization: true },
          },
          activities: {
            with: {
              wbs: true,
              predecessors: true,
              resourceAssignments: {
                with: { resource: true },
              },
            },
          },
          wbsItems: true,
        },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this schedule");
      }

      let content: string;
      let contentType: string;
      let filename: string;
      let xerFileKey: string | undefined;

      switch (body.format) {
        case "xer":
          content = await generateXER(schedule as any);
          contentType = "text/plain";
          filename = `${schedule.name}.xer`;

          // Also upload to S3 and update schedule
          try {
            xerFileKey = await generateAndUploadXER(schedule as any);
            await db
              .update(schedules)
              .set({
                xerFileKey,
                updatedAt: new Date(),
              })
              .where(eq(schedules.id, params.id));
          } catch (error) {
            console.error("Error uploading XER to S3:", error);
            // Continue even if upload fails - we still return the content
          }
          break;
        case "xml":
          content = await generateXML(schedule as any);
          contentType = "application/xml";
          filename = `${schedule.name}.xml`;
          break;
        default:
          throw new Error(`Unsupported format: ${body.format}`);
      }

      return {
        success: true,
        data: {
          content,
          contentType,
          filename,
          xerFileKey, // Include the S3 key if XER was uploaded
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        format: t.Union([t.Literal("xer"), t.Literal("xml")]),
      }),
    }
  )
  .get(
    "/:id/download-xer",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.id),
        with: { project: true },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this schedule");
      }

      // Check if XER file exists
      if (!schedule.xerFileKey) {
        throw new NotFoundError("XER file", "not found for this schedule");
      }

      // Generate signed URL with download header (valid for 1 hour)
      const filename = `${schedule.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.xer`;
      const downloadUrl = await getSignedDownloadUrl(
        schedule.xerFileKey,
        filename,
        3600
      );

      return {
        success: true,
        data: {
          downloadUrl,
          filename,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, params.id),
        with: { project: true },
      });

      if (!schedule) {
        throw new NotFoundError("Schedule", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const membership = userOrgs.find(
        (o) => o.organizationId === schedule.project.organizationId
      );

      if (!membership || membership.role === "member") {
        throw new ForbiddenError(
          "You do not have permission to delete this schedule"
        );
      }

      // Delete S3 file if it exists
      if (schedule.xerFileKey) {
        try {
          await deleteFile(schedule.xerFileKey);
        } catch (error) {
          // Log error but don't fail the deletion if S3 cleanup fails
          console.error(
            `[Schedules API] Failed to delete S3 file for schedule ${schedule.id}:`,
            error
          );
        }
      }

      await db.delete(schedules).where(eq(schedules.id, params.id));

      return { success: true, data: { deleted: true } };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
