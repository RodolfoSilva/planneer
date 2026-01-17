import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { schedules } from "./schedules";
import { chatSessions } from "./chat";

export const projectTypeEnum = pgEnum("project_type", [
  "construction",
  "industrial_maintenance",
  "engineering",
  "it",
  "other",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "planning",
  "in_progress",
  "completed",
  "archived",
]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: projectTypeEnum("type").default("other").notNull(),
  status: projectStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  schedules: many(schedules),
  chatSessions: many(chatSessions),
}));





