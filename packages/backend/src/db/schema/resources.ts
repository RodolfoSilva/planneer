import { pgTable, text, timestamp, pgEnum, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { activities } from './activities';

export const resourceTypeEnum = pgEnum('resource_type', [
  'labor',
  'material',
  'equipment',
  'expense',
]);

export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: resourceTypeEnum('type').default('labor').notNull(),
  unit: text('unit'),
  costPerUnit: real('cost_per_unit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [resources.organizationId],
    references: [organizations.id],
  }),
  assignments: many(resourceAssignments),
}));

export const resourceAssignments = pgTable('resource_assignments', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  units: real('units').default(1).notNull(),
  plannedUnits: real('planned_units').default(0).notNull(),
  actualUnits: real('actual_units').default(0).notNull(),
});

export const resourceAssignmentsRelations = relations(resourceAssignments, ({ one }) => ({
  activity: one(activities, {
    fields: [resourceAssignments.activityId],
    references: [activities.id],
  }),
  resource: one(resources, {
    fields: [resourceAssignments.resourceId],
    references: [resources.id],
  }),
}));



