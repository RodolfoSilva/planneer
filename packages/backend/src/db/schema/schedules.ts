import { pgTable, text, timestamp, pgEnum, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { activities } from './activities';
import { wbs } from './activities';

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: scheduleStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  project: one(projects, {
    fields: [schedules.projectId],
    references: [projects.id],
  }),
  activities: many(activities),
  wbsItems: many(wbs),
}));



