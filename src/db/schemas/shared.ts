import { timestamp } from 'drizzle-orm/pg-core';

export const auditColumns = {
  createTimestamp: timestamp('createTimestamp').defaultNow().notNull(),
  updateTimestamp: timestamp('updateTimestamp').defaultNow().notNull(),
};