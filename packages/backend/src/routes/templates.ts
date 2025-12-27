import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { eq, desc, ilike, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { projectTemplates, templateEmbeddings } from "../db/schema";
import { auth } from "../auth";
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../lib/errors";
import { getUserOrganizations } from "../services/organization";
import { parseXER } from "../services/parser/xer-parser";
import { parseXML } from "../services/parser/xml-parser";
import { generateEmbedding } from "../services/ai/embeddings";
import { uploadFile } from "../services/storage";

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

export const templateRoutes = new Elysia({ prefix: "/api/templates" })
  .get(
    "/",
    async ({ query, request }) => {
      const user = await getAuthUser(request);
      const userOrgs = await getUserOrganizations(user.id);
      const orgIds = userOrgs.map((o) => o.organizationId);

      if (orgIds.length === 0) {
        return { success: true, data: { items: [], total: 0 } };
      }

      const conditions = [inArray(projectTemplates.organizationId, orgIds)];

      if (query.type) {
        conditions.push(eq(projectTemplates.type, query.type));
      }

      if (query.search) {
        conditions.push(ilike(projectTemplates.name, `%${query.search}%`));
      }

      const result = await db.query.projectTemplates.findMany({
        where: and(...conditions),
        orderBy: [desc(projectTemplates.createdAt)],
        with: {
          organization: true,
        },
      });

      return {
        success: true,
        data: {
          items: result,
          total: result.length,
        },
      };
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const template = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, params.id),
        with: {
          organization: true,
        },
      });

      if (!template) {
        throw new NotFoundError("Template", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === template.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this template");
      }

      return { success: true, data: template };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post(
    "/upload",
    async ({ body, request }) => {
      const user = await getAuthUser(request);
      const userOrgs = await getUserOrganizations(user.id);
      const membership = userOrgs.find(
        (o) => o.organizationId === body.organizationId
      );

      if (!membership) {
        throw new ForbiddenError("You do not have access to this organization");
      }

      const file = body.file;
      const fileName = file.name.toLowerCase();

      let parsedData: any;
      const fileBuffer = await file.arrayBuffer();

      if (fileName.endsWith(".xer")) {
        const content = new TextDecoder().decode(fileBuffer);
        parsedData = await parseXER(content);
      } else if (fileName.endsWith(".xml")) {
        const content = new TextDecoder().decode(fileBuffer);
        parsedData = await parseXML(content);
      } else {
        throw new Error("Unsupported file format. Please upload .xer or .xml");
      }

      const id = nanoid();
      const now = new Date();

      const fileKey = `templates/${id}/${file.name}`;
      await uploadFile(fileKey, Buffer.from(fileBuffer), file.type);

      await db.insert(projectTemplates).values({
        id,
        organizationId: body.organizationId,
        name: body.name || parsedData.projectName || file.name,
        description: body.description,
        type: body.type || "other",
        sourceFile: fileKey,
        sourceFormat: fileName.endsWith(".xer") ? "xer" : "xml",
        metadata: parsedData,
        activityCount: String(parsedData.activities?.length || 0),
        totalDuration: String(parsedData.totalDuration || 0),
        createdAt: now,
        updatedAt: now,
      });

      const templateText = JSON.stringify({
        name: body.name || parsedData.projectName,
        type: body.type,
        activities: parsedData.activities?.slice(0, 50),
        wbs: parsedData.wbs?.slice(0, 20),
      });

      try {
        const vector = await generateEmbedding(templateText);

        await db.insert(templateEmbeddings).values({
          id: nanoid(),
          templateId: id,
          chunkType: "full",
          chunkIndex: "0",
          content: templateText.substring(0, 5000),
          embedding: vector,
          createdAt: now,
        });
      } catch (error) {
        console.warn("Failed to generate embedding:", error);
      }

      const template = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, id),
        with: { organization: true },
      });

      return { success: true, data: template };
    },
    {
      body: t.Object({
        organizationId: t.String(),
        file: t.File(),
        name: t.Optional(t.String()),
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
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      const template = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, params.id),
      });

      if (!template) {
        throw new NotFoundError("Template", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === template.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this template");
      }

      await db
        .update(projectTemplates)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(projectTemplates.id, params.id));

      const updated = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, params.id),
        with: { organization: true },
      });

      return { success: true, data: updated };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
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
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const template = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, params.id),
      });

      if (!template) {
        throw new NotFoundError("Template", params.id);
      }

      const userOrgs = await getUserOrganizations(user.id);
      const membership = userOrgs.find(
        (o) => o.organizationId === template.organizationId
      );

      if (!membership || membership.role === "member") {
        throw new ForbiddenError(
          "You do not have permission to delete this template"
        );
      }

      await db
        .delete(templateEmbeddings)
        .where(eq(templateEmbeddings.templateId, params.id));

      await db
        .delete(projectTemplates)
        .where(eq(projectTemplates.id, params.id));

      return { success: true, data: { deleted: true } };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
