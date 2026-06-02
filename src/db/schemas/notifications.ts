import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'study_reminder' | 'sleep_alert' | 'mastery' | 'streak'
    title: text('title').notNull(),
    body: text('body').notNull(),
    read: boolean('read').default(false).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    readIdx: index('notifications_read_idx').on(table.read),
    sentAtIdx: index('notifications_sent_at_idx').on(table.sentAt),
    userIdSentAtIdx: index('notifications_user_id_sent_at_idx').on(table.userId, table.sentAt),
    userIdReadSentAtIdx: index('notifications_user_id_read_sent_at_idx').on(table.userId, table.read, table.sentAt),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
