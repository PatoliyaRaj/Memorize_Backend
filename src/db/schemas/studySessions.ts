import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { baskets } from './baskets';

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  basketId: uuid('basket_id').references(() => baskets.id),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSec: integer('duration_sec'),
  cardsReviewed: integer('cards_reviewed').default(0).notNull(),
  cardsCorrect: integer('cards_correct').default(0).notNull(),
  mode: text('mode', {
    enum: ['normal', 'interleaved', 'exam', 'remedial', 'prereq'],
  })
    .default('normal')
    .notNull(),
  sleepWindowOk: boolean('sleep_window_ok'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
