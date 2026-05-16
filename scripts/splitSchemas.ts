import fs from 'fs';
import path from 'path';

const outDir = path.join(__dirname, '../src/db/schemas');

const files = {
  'users.ts': `import { pgTable, uuid, text, uniqueIndex } from 'drizzle-orm/pg-core';
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
`,

  'userProfiles.ts': `import { pgTable, uuid, text, integer, time, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  learningStyle: text('learning_style', {
    enum: ['visual', 'auditory', 'reading', 'kinesthetic'],
  }),
  dailyGoalMin: integer('daily_goal_min').default(15),
  timezone: text('timezone').default('UTC'),
  sleepTime: time('sleep_time').default('22:30'),
  wakeTime: time('wake_time').default('06:30'),
  optimalStudyAm: time('optimal_study_am').default('08:00'),
  optimalStudyPm: time('optimal_study_pm').default('17:00'),
  streakDays: integer('streak_days').default(0).notNull(),
  lastStudyDate: timestamp('last_study_date', { withTimezone: true }),
  totalCardsMastered: integer('total_cards_mastered').default(0).notNull(),
  onboardingDone: boolean('onboarding_done').default(false).notNull(),
  notificationPref: jsonb('notification_pref')
    .default(sql\`'{"email":true,"push":true,"frequency":"smart"}'::jsonb\`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
`,

  'baskets.ts': `import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';
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
`,

  'subjects.ts': `import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
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
`,

  'playlists.ts': `import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';
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
`,

  'nodes.ts': `import { pgTable, uuid, text, integer, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
    playlistIdx: uniqueIndex('nodes_playlist_user_idx').on(table.playlistId, table.userId),
    masteryIdx: uniqueIndex('nodes_mastery_idx').on(table.userId, table.masteryLevel),
    masteryCheck: check(
      'nodes_mastery_check',
      sql\`mastery_level IN ('unseen','weak','learning','strong','mastered')\`
    ),
  })
);

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
`,

  'nodeDetails.ts': `import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nodes } from './nodes';

export const nodeDetails = pgTable('node_details', {
  nodeId: uuid('node_id')
    .primaryKey()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  theoryContent: text('theory_content'),
  references: jsonb('references').default(sql\`'[]'::jsonb\`).notNull(),
  images: jsonb('images').default(sql\`'[]'::jsonb\`).notNull(),
  thingsToRemember: text('things_to_remember'),
  emotionalAnchor: text('emotional_anchor'),
  isImportant: boolean('is_important').default(false).notNull(),
  examRelevance: text('exam_relevance').array().default(sql\`'{}'::text[]\`).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type NodeDetail = typeof nodeDetails.$inferSelect;
export type NewNodeDetail = typeof nodeDetails.$inferInsert;
`,

  'edges.ts': `import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
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
`,

  'cards.ts': `import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { nodes } from './nodes';
import { auditColumns } from './shared';

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  explanation: text('explanation'),
  questionType: text('question_type', {
    enum: ['free_recall', 'cloze', 'ordering', 'matching', 'multiple_choice'],
  })
    .default('free_recall')
    .notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type', {
    enum: ['image', 'audio', 'video', 'none'],
  }).default('none'),
  orderIndex: integer('order_index').default(0).notNull(),
  sourcePage: integer('source_page'),
  ...auditColumns,
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
`,

  'cardStates.ts': `import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { auditColumns } from './shared';

export const cardStates = pgTable('card_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  stability: integer('stability').default(0).notNull(),
  difficulty: integer('difficulty').default(0).notNull(),
  elapsedDays: integer('elapsed_days').default(0).notNull(),
  scheduledDays: integer('scheduled_days').default(0).notNull(),
  reps: integer('reps').default(0).notNull(),
  lapses: integer('lapses').default(0).notNull(),
  state: text('state', {
    enum: ['New', 'Learning', 'Review', 'Relearning'],
  })
    .default('New')
    .notNull(),
  lastReview: timestamp('last_review', { withTimezone: true }),
  nextReview: timestamp('next_review', { withTimezone: true }),
  confidenceLast: integer('confidence_last'),
  responseTimeMs: integer('response_time_ms'),
  streakCorrect: integer('streak_correct').default(0).notNull(),
  masteryLevel: text('mastery_level', {
    enum: ['new', 'learning', 'reviewing', 'mastered'],
  })
    .default('new')
    .notNull(),
  ...auditColumns,
});

export type CardState = typeof cardStates.$inferSelect;
export type NewCardState = typeof cardStates.$inferInsert;
`,

  'studySessions.ts': `import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { baskets } from './baskets';

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  basketId: uuid('basket_id').references(() => baskets.id),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSec: integer('duration_sec'),
  cardsReviewed: integer('cards_reviewed').default(0).notNull(),
  cardsCorrect: integer('cards_correct').default(0).notNull(),
  mode: text('mode', {
    enum: ['normal', 'interleaved', 'exam', 'remedial', 'prereq'],
  })
    .default('normal')
    .notNull(),
  sleepWindowOk: boolean('sleep_window_ok'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
`,

  'reviews.ts': `import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { studySessions } from './studySessions';

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => studySessions.id),
  fsrsRating: integer('fsrs_rating').notNull(),
  confidence: integer('confidence').notNull(),
  stabilityBefore: integer('stability_before'),
  stabilityAfter: integer('stability_after'),
  difficultyBefore: integer('difficulty_before'),
  difficultyAfter: integer('difficulty_after'),
  scheduledDays: integer('scheduled_days'),
  elapsedDays: integer('elapsed_days'),
  wasCorrect: boolean('was_correct').notNull(),
  responseTimeMs: integer('response_time_ms'),
  reviewType: text('review_type', {
    enum: ['normal', 'remedial', 'prereq', 'interleaved', 'feynman'],
  }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
`,

  'sleepLogs.ts': `import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sleepDate: timestamp('sleep_date', { withTimezone: true }).notNull(),
  sleepTime: timestamp('sleep_time', { withTimezone: true }),
  wakeTime: timestamp('wake_time', { withTimezone: true }),
  durationMin: integer('duration_min'),
  quality: integer('quality'),
  studyBeforeH: integer('study_before_h'),
  consolidationScore: integer('consolidation_score'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SleepLog = typeof sleepLogs.$inferSelect;
export type NewSleepLog = typeof sleepLogs.$inferInsert;
`,

  'pulseQueues.ts': `import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const pulseQueues = pgTable('pulse_queues', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  queueDate: text('queue_date').notNull(),
  cards: jsonb('cards').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  completed: boolean('completed').default(false).notNull(),
});

export type PulseQueue = typeof pulseQueues.$inferSelect;
export type NewPulseQueue = typeof pulseQueues.$inferInsert;
`,

  'relations.ts': `import { relations } from 'drizzle-orm';
import { users } from './users';
import { userProfiles } from './userProfiles';
import { baskets } from './baskets';
import { subjects } from './subjects';
import { playlists } from './playlists';
import { nodes } from './nodes';
import { nodeDetails } from './nodeDetails';
import { edges } from './edges';
import { cards } from './cards';
import { cardStates } from './cardStates';
import { studySessions } from './studySessions';
import { reviews } from './reviews';
import { sleepLogs } from './sleepLogs';
import { pulseQueues } from './pulseQueues';

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  baskets: many(baskets),
  sleepLogs: many(sleepLogs),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const basketsRelations = relations(baskets, ({ one, many }) => ({
  user: one(users, {
    fields: [baskets.userId],
    references: [users.id],
  }),
  subjects: many(subjects),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  basket: one(baskets, {
    fields: [subjects.basketId],
    references: [baskets.id],
  }),
  user: one(users, {
    fields: [subjects.userId],
    references: [users.id],
  }),
  playlists: many(playlists),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [playlists.subjectId],
    references: [subjects.id],
  }),
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  playlist: one(playlists, {
    fields: [nodes.playlistId],
    references: [playlists.id],
  }),
  user: one(users, {
    fields: [nodes.userId],
    references: [users.id],
  }),
  details: one(nodeDetails, {
    fields: [nodes.id],
    references: [nodeDetails.nodeId],
  }),
  cards: many(cards),
  outgoingEdges: many(edges, { relationName: 'source' }),
  incomingEdges: many(edges, { relationName: 'target' }),
}));

export const nodeDetailsRelations = relations(nodeDetails, ({ one }) => ({
  node: one(nodes, {
    fields: [nodeDetails.nodeId],
    references: [nodes.id],
  }),
}));

export const edgesRelations = relations(edges, ({ one }) => ({
  user: one(users, {
    fields: [edges.userId],
    references: [users.id],
  }),
  sourceNode: one(nodes, {
    fields: [edges.sourceNodeId],
    references: [nodes.id],
    relationName: 'source',
  }),
  targetNode: one(nodes, {
    fields: [edges.targetNodeId],
    references: [nodes.id],
    relationName: 'target',
  }),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  node: one(nodes, {
    fields: [cards.nodeId],
    references: [nodes.id],
  }),
  user: one(users, {
    fields: [cards.userId],
    references: [users.id],
  }),
  cardState: one(cardStates, {
    fields: [cards.id],
    references: [cardStates.cardId],
  }),
  reviews: many(reviews),
}));

export const cardStatesRelations = relations(cardStates, ({ one }) => ({
  card: one(cards, {
    fields: [cardStates.cardId],
    references: [cards.id],
  }),
  user: one(users, {
    fields: [cardStates.userId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  card: one(cards, {
    fields: [reviews.cardId],
    references: [cards.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  session: one(studySessions, {
    fields: [reviews.sessionId],
    references: [studySessions.id],
  }),
}));

export const studySessionsRelations = relations(studySessions, ({ one, many }) => ({
  user: one(users, {
    fields: [studySessions.userId],
    references: [users.id],
  }),
  basket: one(baskets, {
    fields: [studySessions.basketId],
    references: [baskets.id],
  }),
  reviews: many(reviews),
}));

export const sleepLogsRelations = relations(sleepLogs, ({ one }) => ({
  user: one(users, {
    fields: [sleepLogs.userId],
    references: [users.id],
  }),
}));

export const pulseQueuesRelations = relations(pulseQueues, ({ one }) => ({
  user: one(users, {
    fields: [pulseQueues.userId],
    references: [users.id],
  }),
}));
`,

  'index.ts': `export * from './users';
export * from './userProfiles';
export * from './baskets';
export * from './subjects';
export * from './playlists';
export * from './nodes';
export * from './nodeDetails';
export * from './edges';
export * from './cards';
export * from './cardStates';
export * from './studySessions';
export * from './reviews';
export * from './sleepLogs';
export * from './pulseQueues';
export * from './relations';
`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, filename), content);
}

console.log('Schemas split successfully!');
