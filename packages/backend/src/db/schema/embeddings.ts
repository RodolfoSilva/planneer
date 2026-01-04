import { pgTable, text, timestamp, vector, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projectTemplates } from './templates';
import { EMBEDDING_DIMENSIONS } from '@planneer/shared';

// Template embeddings for RAG
export const templateEmbeddings = pgTable('template_embeddings', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => projectTemplates.id, { onDelete: 'cascade' }),
  chunkType: text('chunk_type').notNull(), // 'description', 'activities', 'wbs', 'full'
  chunkIndex: text('chunk_index').default('0'),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  embeddingIdx: index('template_embeddings_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
}));

export const templateEmbeddingsRelations = relations(templateEmbeddings, ({ one }) => ({
  template: one(projectTemplates, {
    fields: [templateEmbeddings.templateId],
    references: [projectTemplates.id],
  }),
}));




