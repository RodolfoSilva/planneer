import { Elysia } from "elysia";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const healthRoutes = new Elysia({ prefix: "/api" })
  .get("/health", async () => {
    const checks: Record<string, { status: string; latency?: number }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = { status: "healthy", latency: Date.now() - dbStart };
    } catch {
      checks.database = { status: "unhealthy" };
    }

    const allHealthy = Object.values(checks).every(
      (c) => c.status === "healthy"
    );

    return {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      checks,
    };
  })
  .get("/ready", () => ({
    ready: true,
    timestamp: new Date().toISOString(),
  }));
