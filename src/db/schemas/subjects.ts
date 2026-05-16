import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { baskets } from './baskets';
import { auditColumns } from './shared';

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  basketId: uuid('basket_id')
    .notNull()
    .references(() => baskets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  colorHex: text('color_hex').default('#378ADD'),
  icon: text('icon').default('cpu'),
  position: integer('position').default(0).notNull(),
  ...auditColumns,
});

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
