import { pgTable, uuid, text, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { playlists } from './playlists';
import { auditColumns } from './shared';

export const nodes = pgTable(
  'nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    nodeType: text('node_type', {
      enum: ['concept', 'definition', 'formula', 'process', 'example', 'exception'],
    })
      .default('concept')
      .notNull(),
    posX: integer('pos_x').default(0).notNull(),
    posY: integer('pos_y').default(0).notNull(),
    masteryLevel: text('mastery_level', {
      enum: ['unseen', 'weak', 'learning', 'strong', 'mastered'],
    })
      .default('unseen')
      .notNull(),
    orderIndex: integer('order_index').default(0).notNull(),
    ...auditColumns,
  },
  (table) => ({
    playlistIdx: index('nodes_playlist_user_idx').on(table.playlistId, table.userId),
    masteryIdx: index('nodes_mastery_idx').on(table.userId, table.masteryLevel),
  })
);

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
