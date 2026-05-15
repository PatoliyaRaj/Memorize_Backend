import { pgTable, uuid, varchar, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './shared';


export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('firstName', { length: 255 }).notNull(),
    lastName: varchar('lastName', { length: 255 }).notNull(),
    age: integer('age').notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    isActive: boolean('isActive').default(false).notNull(),
    ...auditColumns,
  },
  (table) => ({
    emailIdx: uniqueIndex('email_idx').on(table.email),
  })
);

export const usersRelations = relations(users, () => ({}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
