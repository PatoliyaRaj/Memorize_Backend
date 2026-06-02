import { relations } from 'drizzle-orm';
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
import { notifications } from './notifications';
import { sleepAlerts } from './sleepAlerts';
import { pushSubscriptions } from './pushSubscriptions';

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  baskets: many(baskets),
  sleepLogs: many(sleepLogs),
  notifications: many(notifications),
  sleepAlerts: many(sleepAlerts),
  pushSubscriptions: many(pushSubscriptions),
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

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const sleepAlertsRelations = relations(sleepAlerts, ({ one }) => ({
  user: one(users, {
    fields: [sleepAlerts.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));
