import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./routes/auth";
import { organizationRoutes } from "./routes/organizations";
import { projectRoutes } from "./routes/projects";
import { scheduleRoutes } from "./routes/schedules";
import { templateRoutes } from "./routes/templates";
import { chatRoutes } from "./routes/chat";
import { healthRoutes } from "./routes/health";
import { websocketRoutes } from "./routes/websocket";

const app = new Elysia()
  .use(
    cors({
      origin: [
        process.env.FRONTEND_URL || "http://localhost:3000",
        "http://localhost:3000",
      ],
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Planneer API",
          version: "1.0.0",
          description: "API for AI-powered project schedule generation",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Projects", description: "Project management" },
          { name: "Schedules", description: "Schedule management" },
          { name: "Templates", description: "Template management and import" },
          { name: "Chat", description: "AI chat for schedule generation" },
        ],
      },
    })
  )
  .use(healthRoutes)
  .use(authRoutes)
  .use(organizationRoutes)
  .use(projectRoutes)
  .use(scheduleRoutes)
  .use(templateRoutes)
  .use(chatRoutes)
  .use(websocketRoutes)
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.message,
        },
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
        },
      };
    }

    set.status = 500;
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    };
  })
  .listen(process.env.PORT || 4000);

console.log(
  `🚀 Planneer API is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `📚 Swagger docs available at http://localhost:${app.server?.port}/swagger`
);

export type App = typeof app;
