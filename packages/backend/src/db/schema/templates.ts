import { pgTable, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { projectTypeEnum } from './projects';
import { templateEmbeddings } from './embeddings';

export const sourceFormatEnum = pgEnum('source_format', ['xer', 'xml', 'manual']);

export const projectTemplates = pgTable('project_templates', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: projectTypeEnum('type').default('other').notNull(),
  sourceFile: text('source_file'),
  sourceFormat: sourceFormatEnum('source_format').default('manual').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  // Denormalized data for quick access
  activityCount: text('activity_count'),
  totalDuration: text('total_duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectTemplatesRelations = relations(projectTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectTemplates.organizationId],
    references: [organizations.id],
  }),
  embeddings: many(templateEmbeddings),
}));

// Template activities (stored separately for RAG)
export const templateActivities = pgTable('template_activities', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => projectTemplates.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  duration: text('duration'),
  durationUnit: text('duration_unit'),
  wbsPath: text('wbs_path'),
  predecessors: text('predecessors'), // Stored as comma-separated codes
  resources: text('resources'), // Stored as comma-separated names
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templateActivitiesRelations = relations(templateActivities, ({ one }) => ({
  template: one(projectTemplates, {
    fields: [templateActivities.templateId],
    references: [projectTemplates.id],
  }),
}));




