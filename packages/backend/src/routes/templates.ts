import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { eq, desc, ilike, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { projectTemplates, templateEmbeddings, templateActivities } from "../db/schema";
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
import { decodeFileContent } from "../lib/text-encoding";

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
        const content = decodeFileContent(fileBuffer, fileName);
        parsedData = await parseXER(content);
      } else if (fileName.endsWith(".xml")) {
        const content = decodeFileContent(fileBuffer, fileName);
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

      // Save activities to template_activities table
      if (parsedData.activities && parsedData.activities.length > 0) {
        const activitiesToInsert = parsedData.activities.map((activity: any) => ({
          id: nanoid(),
          templateId: id,
          code: activity.code || `ACT${nanoid()}`,
          name: activity.name || "Unnamed Activity",
          description: activity.description || null,
          duration: activity.duration ? String(activity.duration) : null,
          durationUnit: activity.durationUnit || "days",
          wbsPath: activity.wbsPath || null,
          predecessors: activity.predecessors && Array.isArray(activity.predecessors)
            ? activity.predecessors.join(",")
            : activity.predecessors || null,
          resources: activity.resources && Array.isArray(activity.resources)
            ? activity.resources.join(",")
            : activity.resources || null,
          createdAt: now,
        }));

        if (activitiesToInsert.length > 0) {
          await db.insert(templateActivities).values(activitiesToInsert);
        }
      }

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
  )
  .get(
    "/:id/activities",
    async ({ params, request }) => {
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

      // Try to get activities from templateActivities table first
      const dbActivities = await db.query.templateActivities.findMany({
        where: eq(templateActivities.templateId, params.id),
      });

      // If activities exist in the table, return them
      if (dbActivities.length > 0) {
        return {
          success: true,
          data: {
            items: dbActivities,
            total: dbActivities.length,
          },
        };
      }

      // Otherwise, get activities from metadata
      const metadata = template.metadata as any;
      const activities = metadata?.activities || [];

      return {
        success: true,
        data: {
          items: activities,
          total: activities.length,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post(
    "/:id/migrate-activities",
    async ({ params, request }) => {
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

      // Check if activities already exist in table
      const existingActivities = await db.query.templateActivities.findMany({
        where: eq(templateActivities.templateId, params.id),
      });

      if (existingActivities.length > 0) {
        return {
          success: true,
          data: {
            message: "Activities already migrated",
            count: existingActivities.length,
          },
        };
      }

      // Get activities from metadata
      const metadata = template.metadata as any;
      const metadataActivities = metadata?.activities || [];

      if (metadataActivities.length === 0) {
        return {
          success: false,
          data: {
            message: "No activities found in template metadata",
            count: 0,
          },
        };
      }

      // Migrate activities to template_activities table
      const activitiesToInsert = metadataActivities.map((activity: any) => ({
        id: nanoid(),
        templateId: params.id,
        code: activity.code || `ACT${nanoid()}`,
        name: activity.name || "Unnamed Activity",
        description: activity.description || null,
        duration: activity.duration ? String(activity.duration) : null,
        durationUnit: activity.durationUnit || "days",
        wbsPath: activity.wbsPath || null,
        predecessors: activity.predecessors && Array.isArray(activity.predecessors)
          ? activity.predecessors.join(",")
          : activity.predecessors || null,
        resources: activity.resources && Array.isArray(activity.resources)
          ? activity.resources.join(",")
          : activity.resources || null,
        createdAt: new Date(),
      }));

      if (activitiesToInsert.length > 0) {
        await db.insert(templateActivities).values(activitiesToInsert);
      }

      return {
        success: true,
        data: {
          message: "Activities migrated successfully",
          count: activitiesToInsert.length,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
