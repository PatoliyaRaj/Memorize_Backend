import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { nodes } from './nodes';
import { auditColumns } from './shared';

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  explanation: text('explanation'),
  questionType: text('question_type', {
    enum: ['free_recall', 'cloze', 'ordering', 'matching', 'multiple_choice'],
  })
    .default('free_recall')
    .notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type', {
    enum: ['image', 'audio', 'video', 'none'],
  }).default('none'),
  orderIndex: integer('order_index').default(0).notNull(),
  sourcePage: integer('source_page'),
  ...auditColumns,
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
