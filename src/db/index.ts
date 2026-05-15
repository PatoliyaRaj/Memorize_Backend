import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let pool: Pool | null = null;

/**
 * Initialize database connection and Drizzle ORM instance
 */
export const initializeDatabase = async (): Promise<ReturnType<typeof drizzle>> => {
  if (dbInstance) {
    return dbInstance;
  }

  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not defined');
  }

  try {
    // Create connection pool
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection established');
    client.release();

    // Initialize Drizzle instance
    dbInstance = drizzle(pool, { schema });
    console.log('✅ Drizzle ORM initialized');

    return dbInstance;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Get the Drizzle database instance
 * Initializes if not already done
 */
export const getDatabase = async (): Promise<ReturnType<typeof drizzle>> => {
  if (!dbInstance) {
    return await initializeDatabase();
  }
  return dbInstance;
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    console.log('✅ Database connection closed');
  }
  dbInstance = null;
};

/**
 * Verify database is ready
 */
export const verifyDatabaseReady = async (): Promise<boolean> => {
  try {
    if (!pool) {
      return false;
    }
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    return !!result.rows[0];
  } catch {
    return false;
  }
};

export { schema };
