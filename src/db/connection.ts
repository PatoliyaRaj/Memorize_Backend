/**
 * Database Connection — Drizzle ORM + postgres-js
 *
 * TWO connection modes for Hybrid Dev/Prod setup:
 *  1. LOCAL (dev):  Direct Postgres → supports prepared statements, full pool
 *  2. SUPABASE (prod): Transaction Pooler → MUST disable prepare (prepared
 *     statements not supported in Transaction pool mode per Supabase docs)
 *
 * Driver: postgres-js (npm: "postgres")
 *   - Recommended by Drizzle docs for Supabase
 *   - Works in both Node.js servers AND edge runtimes
 *   - NOT pg/node-postgres (that driver lacks prepare:false support cleanly)
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { resolveDatabaseConnectionString, getDatabaseStrategy, getPoolSettings } from './config';

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: DrizzleDB | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

/**
 * Builds the postgres-js client with the correct settings for each environment.
 *
 * CRITICAL for Supabase Transaction Pooler:
 *   prepare: false — Transaction pool mode does NOT support prepared statements.
 *   Leaving this on causes "prepared statement already exists" crashes in prod.
 */
const createClient = (): ReturnType<typeof postgres> => {
  const connectionString = resolveDatabaseConnectionString();
  const strategy = getDatabaseStrategy();
  const poolSettings = getPoolSettings();

  const isSupabase = strategy === 'supabase';

  const client = postgres(connectionString, {
    // Supabase Transaction Pooler REQUIRES prepare:false
    // Local Postgres can use prepared statements (better performance)
    prepare: !isSupabase,

    // Connection pool settings from env (PG_POOL_MAX etc.)
    max: poolSettings.max,
    idle_timeout: Math.floor(poolSettings.idleTimeoutMillis / 1000), // postgres-js uses seconds

    // SSL: required for Supabase cloud, disabled for local
    ssl: isSupabase ? { rejectUnauthorized: false } : false,

    // Connection timeout
    connect_timeout: Math.floor(poolSettings.connectionTimeoutMillis / 1000),

    // Identify connections in pg_stat_activity for easier debugging
    connection: {
      application_name: `neurolearn-${process.env.NODE_ENV ?? 'development'}`,
    },

    onnotice: () => {
      // Suppress NOTICE messages from PostgreSQL (e.g., "relation already exists")
    },
  });

  return client;
};

/**
 * Initialize Drizzle with the postgres-js client.
 * Call once at server startup in server.ts.
 * Subsequent calls return the cached instance (singleton).
 */
export const initializeDatabase = async (): Promise<DrizzleDB> => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const strategy = getDatabaseStrategy();
    console.log(`📦 DB Strategy: ${strategy}`);

    sqlClient = createClient();

    // Verify connection with a lightweight query
    await sqlClient`SELECT 1`;
    console.log('✅ Database connection established');

    dbInstance = drizzle(sqlClient, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    });

    console.log('✅ Drizzle ORM initialized');
    return dbInstance;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Returns the initialized Drizzle instance.
 * Auto-initializes if not yet done (useful in tests or lazy contexts).
 */
export const getDatabase = async (): Promise<DrizzleDB> => {
  if (!dbInstance) {
    return initializeDatabase();
  }
  return dbInstance;
};

/**
 * Synchronous getter — only safe to call AFTER initializeDatabase() has resolved.
 * Use in route handlers / services where startup has already completed.
 */
export const getDb = (): DrizzleDB => {
  if (!dbInstance) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first (in server.ts startup).'
    );
  }
  return dbInstance;
};

/**
 * Graceful shutdown — closes all open postgres-js connections.
 * Called on SIGTERM/SIGINT in server.ts.
 */
export const closeDatabase = async (): Promise<void> => {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    console.log('✅ Database connection pool closed');
  }
  sqlClient = null;
  dbInstance = null;
};

/**
 * Liveness check — used by /ready health endpoint.
 * Runs a cheap SELECT NOW() to confirm the pool is responsive.
 */
export const verifyDatabaseReady = async (): Promise<boolean> => {
  try {
    if (!sqlClient) return false;
    await sqlClient`SELECT NOW()`;
    return true;
  } catch {
    return false;
  }
};
