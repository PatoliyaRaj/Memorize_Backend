import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sleepAlerts = pgTable(
  'sleep_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    alertType: text('alert_type').notNull(), // 'too_late' | 'sleep_debt' | 'optimal_window' | 'post_study_reminder'
    message: text('message').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    acknowledged: boolean('acknowledged').default(false).notNull(),
  },
  (table) => ({
    userIdIdx: index('sleep_alerts_user_id_idx').on(table.userId),
    alertTypeIdx: index('sleep_alerts_type_idx').on(table.alertType),
  })
);

export type SleepAlert = typeof sleepAlerts.$inferSelect;
export type NewSleepAlert = typeof sleepAlerts.$inferInsert;
