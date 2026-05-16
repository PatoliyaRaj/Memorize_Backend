/**
 * Public DB module surface.
 *
 * Import from here everywhere in the app — never import directly from
 * connection.ts or config.ts to keep the API surface clean.
 *
 * Usage in route handlers / services:
 *   import { getDb } from '@/db';
 *   const db = getDb(); // sync, safe after server startup
 *
 * Usage in server.ts startup:
 *   import { initializeDatabase, closeDatabase } from '@/db';
 */

export {
  initializeDatabase,
  getDatabase,
  getDb,           // ← synchronous getter for use after startup
  closeDatabase,
  verifyDatabaseReady,
  type DrizzleDB,
} from './connection';

export {
  getDatabaseStrategy,
  getDatabaseCandidates,
  resolveDatabaseConnectionString,
  getResolvedDatabaseTarget,
  getPoolSettings,
  type DatabaseStrategy,
  type DatabaseCandidate,
} from './config';

// Re-export the entire schema namespace for Drizzle queries
export * as schema from './schema';

// Re-export individual table objects and types for convenience
export * from './schemas';
