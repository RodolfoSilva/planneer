import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { organizations, organizationMembers, users } from "../db/schema";
import { auth } from "../auth";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "../lib/errors";
import { getUserOrganizations, getUserRole } from "../services/organization";

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

// Helper to check if user has admin/owner rights
async function requireAdminRole(userId: string, organizationId: string) {
  const role = await getUserRole(userId, organizationId);
  if (!role) {
    throw new NotFoundError("Organization", organizationId);
  }
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Admin or owner role required");
  }
  return role;
}

export const organizationRoutes = new Elysia({ prefix: "/api/organizations" })
  .get("/", async ({ request }) => {
    const user = await getAuthUser(request);
    const userOrgs = await getUserOrganizations(user.id);
    
    if (userOrgs.length === 0) {
      return { success: true, data: { items: [], total: 0 } };
    }
    
    const orgIds = userOrgs.map((o) => o.organizationId);
    
    const result = await db.query.organizations.findMany({
      where: (orgs, { inArray }) => inArray(orgs.id, orgIds),
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
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some((o) => o.organizationId === params.id);
      
      if (!hasAccess) {
        throw new NotFoundError("Organization", params.id);
      }
      
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, params.id),
      });
      
      if (!org) {
        throw new NotFoundError("Organization", params.id);
      }
      
      return { success: true, data: org };
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
      
      const id = nanoid();
      const now = new Date();
      
      // Create organization
      await db.insert(organizations).values({
        id,
        name: body.name,
        slug: body.slug,
        createdAt: now,
        updatedAt: now,
      });
      
      // Add user as owner
      await db.insert(organizationMembers).values({
        id: nanoid(),
        organizationId: id,
        userId: user.id,
        role: "owner",
        createdAt: now,
      });
      
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, id),
      });
      
      return { success: true, data: org };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        slug: t.String({ minLength: 1, maxLength: 100 }),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      await requireAdminRole(user.id, params.id);
      
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      
      if (body.name) updateData.name = body.name;
      if (body.slug) updateData.slug = body.slug;
      if (body.logo !== undefined) updateData.logo = body.logo;
      
      await db.update(organizations)
        .set(updateData)
        .where(eq(organizations.id, params.id));
      
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, params.id),
      });
      
      return { success: true, data: org };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        logo: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const role = await getUserRole(user.id, params.id);
      
      if (!role) {
        throw new NotFoundError("Organization", params.id);
      }
      
      // Only owner can delete
      if (role !== "owner") {
        throw new ForbiddenError("Only the owner can delete this organization");
      }
      
      await db.delete(organizations).where(eq(organizations.id, params.id));
      
      return { success: true, data: { deleted: true } };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .get(
    "/:id/members",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some((o) => o.organizationId === params.id);
      
      if (!hasAccess) {
        throw new NotFoundError("Organization", params.id);
      }
      
      const members = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.organizationId, params.id),
        with: {
          user: true,
        },
      });
      
      return {
        success: true,
        data: {
          items: members.map((m) => ({
            id: m.id,
            role: m.role,
            createdAt: m.createdAt,
            user: {
              id: m.user.id,
              name: m.user.name,
              email: m.user.email,
              image: m.user.image,
            },
          })),
          total: members.length,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );

