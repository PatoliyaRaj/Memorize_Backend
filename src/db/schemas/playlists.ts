import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { subjects } from './subjects';
import { auditColumns } from './shared';

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectId: uuid('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').default(0).notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  nodeCount: integer('node_count').default(0).notNull(),
  ...auditColumns,
});

export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;
