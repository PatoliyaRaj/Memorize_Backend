import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { resolveDatabaseConnectionString, getDatabaseStrategy } from './src/db/config';

const strategy = getDatabaseStrategy();
const connectionString = resolveDatabaseConnectionString();

console.log(`[drizzle-kit] Strategy: ${strategy} | URL: ${connectionString.slice(0, 40)}...`);

export default defineConfig({
  // Schema: all files inside the schemas folder
  schema: './src/db/schemas',

  // Migration output directory
  out: './drizzle',

  dialect: 'postgresql',

  dbCredentials: {
    url: connectionString,
  },

  // Print every SQL statement drizzle-kit generates — useful for review
  verbose: true,

  // In strict mode, drizzle-kit will ask for confirmation before destructive ops
  strict: true,

  // Extra migrations folder for hand-written SQL (RLS policies, triggers, etc.)
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
});
