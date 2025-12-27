import { pgTable, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';
import { schedules } from './schedules';
import { organizations } from './organizations';

export const chatSessionStatusEnum = pgEnum('chat_session_status', [
  'active',
  'completed',
  'abandoned',
]);

export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
]);

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
  status: chatSessionStatusEnum('status').default('active').notNull(),
  context: jsonb('context').$type<ChatSessionContext>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface ChatSessionContext {
  projectType?: string;
  projectDescription?: string;
  similarTemplateIds?: string[];
  collectedInfo?: Record<string, unknown>;
  currentStep?: string;
  generatedScheduleId?: string;
}

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [chatSessions.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [chatSessions.projectId],
    references: [projects.id],
  }),
  schedule: one(schedules, {
    fields: [chatSessions.scheduleId],
    references: [schedules.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));



