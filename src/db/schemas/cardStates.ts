import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { auditColumns } from './shared';

export const cardStates = pgTable('card_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  stability: integer('stability').default(0).notNull(),
  difficulty: integer('difficulty').default(0).notNull(),
  elapsedDays: integer('elapsed_days').default(0).notNull(),
  scheduledDays: integer('scheduled_days').default(0).notNull(),
  reps: integer('reps').default(0).notNull(),
  lapses: integer('lapses').default(0).notNull(),
  learningSteps: integer('learning_steps').default(0).notNull(),
  state: text('state', {
    enum: ['New', 'Learning', 'Review', 'Relearning'],
  })
    .default('New')
    .notNull(),
  lastReview: timestamp('last_review', { withTimezone: true }),
  nextReview: timestamp('next_review', { withTimezone: true }),
  confidenceLast: integer('confidence_last'),
  responseTimeMs: integer('response_time_ms'),
  streakCorrect: integer('streak_correct').default(0).notNull(),
  masteryLevel: text('mastery_level', {
    enum: ['new', 'learning', 'reviewing', 'mastered'],
  })
    .default('new')
    .notNull(),
  ...auditColumns,
});

export type CardState = typeof cardStates.$inferSelect;
export type NewCardState = typeof cardStates.$inferInsert;
