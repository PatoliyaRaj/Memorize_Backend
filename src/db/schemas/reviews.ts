import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { studySessions } from './studySessions';

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => studySessions.id),
  fsrsRating: integer('fsrs_rating').notNull(),
  confidence: integer('confidence').notNull(),
  stabilityBefore: integer('stability_before'),
  stabilityAfter: integer('stability_after'),
  difficultyBefore: integer('difficulty_before'),
  difficultyAfter: integer('difficulty_after'),
  scheduledDays: integer('scheduled_days'),
  elapsedDays: integer('elapsed_days'),
  wasCorrect: boolean('was_correct').notNull(),
  responseTimeMs: integer('response_time_ms'),
  reviewType: text('review_type', {
    enum: ['normal', 'remedial', 'prereq', 'interleaved', 'feynman'],
  }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
