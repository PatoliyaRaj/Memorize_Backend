/**
 * Shared audit columns used across all tables.
 *
 * Using TIMESTAMPTZ (with timezone) — stores as UTC, renders in user's timezone.
 * This is a production requirement for any multi-timezone platform.
 */

import { timestamp } from 'drizzle-orm/pg-core';

export const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};