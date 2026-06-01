import 'dotenv/config';
import postgres from 'postgres';
import { getDatabaseStrategy, resolveDatabaseConnectionString, getPoolSettings } from '@/db/config';

const createClient = () => {
  const strategy = getDatabaseStrategy();
  const connectionString = resolveDatabaseConnectionString();
  const poolSettings = getPoolSettings();
  const isSupabase = strategy === 'supabase';

  return postgres(connectionString, {
    prepare: !isSupabase,
    max: poolSettings.max,
    idle_timeout: Math.floor(poolSettings.idleTimeoutMillis / 1000),
    connect_timeout: Math.floor(poolSettings.connectionTimeoutMillis / 1000),
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    connection: {
      application_name: `memorize-preflight-${process.env.NODE_ENV ?? 'development'}`,
    },
  });
};

const preflightSql = `
alter table if exists public.nodes drop constraint if exists nodes_mastery_check;
`;

const main = async () => {
  const client = createClient();

  try {
    const strategy = getDatabaseStrategy();
    console.log(`[db:preflight] Running cleanup against ${strategy} connection`);
    await client.unsafe(preflightSql);
    console.log('[db:preflight] Cleanup completed successfully');
  } finally {
    await client.end({ timeout: 5 });
  }
};

main().catch((error) => {
  console.error('[db:preflight] Cleanup failed');
  console.error(error);
  process.exitCode = 1;
});