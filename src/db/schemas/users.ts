import { pgTable, uuid, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { auditColumns } from './shared';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    ...auditColumns,
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
