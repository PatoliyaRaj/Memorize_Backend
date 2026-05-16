import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const pulseQueues = pgTable('pulse_queues', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  queueDate: text('queue_date').notNull(),
  cards: jsonb('cards').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  completed: boolean('completed').default(false).notNull(),
});

export type PulseQueue = typeof pulseQueues.$inferSelect;
export type NewPulseQueue = typeof pulseQueues.$inferInsert;
