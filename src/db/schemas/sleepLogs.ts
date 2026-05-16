import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sleepDate: timestamp('sleep_date', { withTimezone: true }).notNull(),
  sleepTime: timestamp('sleep_time', { withTimezone: true }),
  wakeTime: timestamp('wake_time', { withTimezone: true }),
  durationMin: integer('duration_min'),
  quality: integer('quality'),
  studyBeforeH: integer('study_before_h'),
  consolidationScore: integer('consolidation_score'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SleepLog = typeof sleepLogs.$inferSelect;
export type NewSleepLog = typeof sleepLogs.$inferInsert;
