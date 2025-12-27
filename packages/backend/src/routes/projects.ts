import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { projects, projectTypeEnum, projectStatusEnum } from "../db/schema";
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

export const projectRoutes = new Elysia({ prefix: "/api/projects" })
  .get("/", async ({ request }) => {
    const user = await getAuthUser(request);
    const userOrgs = await getUserOrganizations(user.id);
    const orgIds = userOrgs.map((o) => o.organizationId);

    if (orgIds.length === 0) {
      return { success: true, data: { items: [], total: 0 } };
    }

    const result = await db.query.projects.findMany({
      where: (projects, { inArray }) =>
        inArray(projects.organizationId, orgIds),
      orderBy: [desc(projects.updatedAt)],
      with: {
        organization: true,
        schedules: {
          limit: 1,
          orderBy: (schedules, { desc }) => [desc(schedules.updatedAt)],
        },
      },
    });

    return {
      success: true,
      data: {
        items: result,
        total: result.length,
      },
    };
  })
  .get(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
        with: {
          organization: true,
          schedules: true,
        },
      });

      if (!project) {
        throw new NotFoundError("Project", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this project");
      }

      return { success: true, data: project };
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
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === body.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this organization");
      }

      const id = nanoid();
      const now = new Date();

      await db.insert(projects).values({
        id,
        organizationId: body.organizationId,
        name: body.name,
        description: body.description,
        type: body.type,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, id),
        with: { organization: true },
      });

      return { success: true, data: project };
    },
    {
      body: t.Object({
        organizationId: t.String(),
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String()),
        type: t.Union([
          t.Literal("construction"),
          t.Literal("industrial_maintenance"),
          t.Literal("engineering"),
          t.Literal("it"),
          t.Literal("other"),
        ]),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
      });

      if (!project) {
        throw new NotFoundError("Project", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === project.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this project");
      }

      await db
        .update(projects)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, params.id));

      const updated = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
        with: { organization: true },
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
        type: t.Optional(
          t.Union([
            t.Literal("construction"),
            t.Literal("industrial_maintenance"),
            t.Literal("engineering"),
            t.Literal("it"),
            t.Literal("other"),
          ])
        ),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("planning"),
            t.Literal("in_progress"),
            t.Literal("completed"),
            t.Literal("archived"),
          ])
        ),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
      });

      if (!project) {
        throw new NotFoundError("Project", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const membership = userOrgs.find(
        (o) => o.organizationId === project.organizationId
      );

      if (!membership || membership.role === "member") {
        throw new ForbiddenError(
          "You do not have permission to delete this project"
        );
      }

      await db.delete(projects).where(eq(projects.id, params.id));

      return { success: true, data: { deleted: true } };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
