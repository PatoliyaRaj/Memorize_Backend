import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { auditColumns } from './shared';

export const baskets = pgTable('baskets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  fieldTag: text('field_tag'),
  colorHex: text('color_hex').default('#1D9E75'),
  icon: text('icon').default('folder'),
  position: integer('position').default(0).notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  ...auditColumns,
});

export type Basket = typeof baskets.$inferSelect;
export type NewBasket = typeof baskets.$inferInsert;
