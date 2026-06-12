import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nodes } from './nodes';

export const nodeDetails = pgTable('node_details', {
  nodeId: uuid('node_id')
    .primaryKey()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  theoryContent: text('theory_content'),
  references: jsonb('references').default(sql`'[]'::jsonb`).notNull(),
  images: jsonb('images').default(sql`'[]'::jsonb`).notNull(),
  files: jsonb('files').default(sql`'[]'::jsonb`).notNull(),
  thingsToRemember: text('things_to_remember'),
  emotionalAnchor: text('emotional_anchor'),
  isImportant: boolean('is_important').default(false).notNull(),
  examRelevance: text('exam_relevance').array().default(sql`'{}'::text[]`).notNull(),
  detectedAudience: text('detected_audience'),
  detectedSubject: text('detected_subject'),
  detectionSource: text('detection_source'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type NodeDetail = typeof nodeDetails.$inferSelect;
export type NewNodeDetail = typeof nodeDetails.$inferInsert;
