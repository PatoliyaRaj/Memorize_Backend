import { pgTable, uuid, varchar, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './shared';

export const nodes = pgTable('nodes', {
  Id: uuid('Id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  Links: text('Links').array().notNull().default([]),
  ImageUrl: varchar('ImageUrl', { length: 500 }),
  ...auditColumns,
});

export const nodesRelations = relations(nodes, () => ({}));

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
