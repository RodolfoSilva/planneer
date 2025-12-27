import { Elysia, t } from "elysia";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { chatSessions, chatMessages } from "../db/schema";
import { auth } from "../auth";
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../lib/errors";
import { getUserOrganizations } from "../services/organization";
import { ChatService } from "../services/chat";

const chatService = new ChatService();

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

export const chatRoutes = new Elysia({ prefix: "/api/chat" })
  .post(
    "/start",
    async ({ body, request }) => {
      const user = await getAuthUser(request);
      const userOrgs = await getUserOrganizations(user.id);
      const hasAccess = userOrgs.some(
        (o) => o.organizationId === body.organizationId
      );

      if (!hasAccess) {
        throw new ForbiddenError("You do not have access to this organization");
      }

      const session = await chatService.startSession({
        userId: user.id,
        organizationId: body.organizationId,
        projectType: body.projectType,
        projectDescription: body.projectDescription,
      });

      return { success: true, data: session };
    },
    {
      body: t.Object({
        organizationId: t.String(),
        projectType: t.Union([
          t.Literal("construction"),
          t.Literal("industrial_maintenance"),
          t.Literal("engineering"),
          t.Literal("it"),
          t.Literal("other"),
        ]),
        projectDescription: t.String({ minLength: 10 }),
      }),
    }
  )
  .get(
    "/:sessionId",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, params.sessionId),
        with: {
          messages: {
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
          },
        },
      });

      if (!session) {
        throw new NotFoundError("Chat session", params.sessionId);
      }

      if (session.userId !== user.id) {
        throw new ForbiddenError("You do not have access to this chat session");
      }

      // Check and process any pending messages in the background
      // This ensures that if the server restarted while processing a message,
      // the message will be processed when the session is loaded
      chatService.processPendingMessage(params.sessionId).catch((error) => {
        console.error("[ChatRoutes] Error processing pending message:", error);
      });

      return { success: true, data: session };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
    }
  )
  .get("/", async ({ request }) => {
    const user = await getAuthUser(request);
    const sessions = await db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, user.id),
      orderBy: [desc(chatSessions.updatedAt)],
    });

    return {
      success: true,
      data: {
        items: sessions,
        total: sessions.length,
      },
    };
  })
  .post(
    "/:sessionId/message",
    async ({ params, body, request }) => {
      const user = await getAuthUser(request);
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, params.sessionId),
      });

      if (!session) {
        throw new NotFoundError("Chat session", params.sessionId);
      }

      if (session.userId !== user.id) {
        throw new ForbiddenError("You do not have access to this chat session");
      }

      const response = await chatService.sendMessage(
        params.sessionId,
        body.content
      );

      return { success: true, data: response };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        content: t.String({ minLength: 1 }),
      }),
    }
  )
  .post(
    "/:sessionId/generate",
    async ({ params, request }) => {
      const user = await getAuthUser(request);
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, params.sessionId),
      });

      if (!session) {
        throw new NotFoundError("Chat session", params.sessionId);
      }

      if (session.userId !== user.id) {
        throw new ForbiddenError("You do not have access to this chat session");
      }

      const schedule = await chatService.generateSchedule(params.sessionId);

      return { success: true, data: schedule };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
    }
  );
