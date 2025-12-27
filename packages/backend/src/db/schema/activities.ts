import { pgTable, text, timestamp, pgEnum, integer, real, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { schedules } from './schedules';
import { resourceAssignments } from './resources';

export const activityTypeEnum = pgEnum('activity_type', [
  'task',
  'milestone',
  'summary',
  'start_milestone',
  'finish_milestone',
]);

export const durationUnitEnum = pgEnum('duration_unit', [
  'hours',
  'days',
  'weeks',
  'months',
]);

export const relationshipTypeEnum = pgEnum('relationship_type', [
  'FS', // Finish-to-Start
  'FF', // Finish-to-Finish
  'SS', // Start-to-Start
  'SF', // Start-to-Finish
]);

// WBS (Work Breakdown Structure)
export const wbs = pgTable('wbs', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  code: text('code').notNull(),
  name: text('name').notNull(),
  level: integer('level').default(1).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const wbsRelations = relations(wbs, ({ one, many }) => ({
  schedule: one(schedules, {
    fields: [wbs.scheduleId],
    references: [schedules.id],
  }),
  parent: one(wbs, {
    fields: [wbs.parentId],
    references: [wbs.id],
    relationName: 'wbsHierarchy',
  }),
  children: many(wbs, { relationName: 'wbsHierarchy' }),
  activities: many(activities),
}));

// Activities
export const activities = pgTable('activities', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  wbsId: text('wbs_id').references(() => wbs.id, { onDelete: 'set null' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  duration: real('duration').default(0).notNull(),
  durationUnit: durationUnitEnum('duration_unit').default('days').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  actualStart: date('actual_start'),
  actualEnd: date('actual_end'),
  percentComplete: real('percent_complete').default(0).notNull(),
  activityType: activityTypeEnum('activity_type').default('task').notNull(),
  calendarId: text('calendar_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  schedule: one(schedules, {
    fields: [activities.scheduleId],
    references: [schedules.id],
  }),
  wbs: one(wbs, {
    fields: [activities.wbsId],
    references: [wbs.id],
  }),
  predecessors: many(activityRelationships, { relationName: 'successor' }),
  successors: many(activityRelationships, { relationName: 'predecessor' }),
  resourceAssignments: many(resourceAssignments),
}));

// Activity Relationships (Predecessors/Successors)
export const activityRelationships = pgTable('activity_relationships', {
  id: text('id').primaryKey(),
  predecessorId: text('predecessor_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  successorId: text('successor_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  type: relationshipTypeEnum('type').default('FS').notNull(),
  lag: real('lag').default(0).notNull(),
  lagUnit: durationUnitEnum('lag_unit').default('days').notNull(),
});

export const activityRelationshipsRelations = relations(activityRelationships, ({ one }) => ({
  predecessor: one(activities, {
    fields: [activityRelationships.predecessorId],
    references: [activities.id],
    relationName: 'predecessor',
  }),
  successor: one(activities, {
    fields: [activityRelationships.successorId],
    references: [activities.id],
    relationName: 'successor',
  }),
}));



