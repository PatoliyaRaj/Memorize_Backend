import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { nodes } from './nodes';

export const edges = pgTable('edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceNodeId: uuid('source_node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  targetNodeId: uuid('target_node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  edgeType: text('edge_type', {
    enum: [
      'prerequisite_of',
      'leads_to',
      'related_to',
      'example_of',
      'exception_to',
      'part_of',
    ],
  }).notNull(),
  label: text('label'),
  strength: integer('strength').default(100).notNull(),
  isCrossPlaylist: boolean('is_cross_playlist').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Edge = typeof edges.$inferSelect;
export type NewEdge = typeof edges.$inferInsert;
