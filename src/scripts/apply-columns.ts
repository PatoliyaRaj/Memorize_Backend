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
      application_name: `memorize-migration-${process.env.NODE_ENV ?? 'development'}`,
    },
  });
};

const migrationSql = `
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "academic_level" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "study_goals" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "occupation" text;
ALTER TABLE "node_details" ADD COLUMN IF NOT EXISTS "detected_audience" text;
ALTER TABLE "node_details" ADD COLUMN IF NOT EXISTS "detected_subject" text;
ALTER TABLE "node_details" ADD COLUMN IF NOT EXISTS "detection_source" text;
`;

const main = async () => {
  const client = createClient();

  try {
    const strategy = getDatabaseStrategy();
    console.log(`[db:apply-columns] Applying columns against ${strategy} connection`);
    await client.unsafe(migrationSql);
    console.log('[db:apply-columns] Column migration completed successfully');
  } finally {
    await client.end({ timeout: 5 });
  }
};

main().catch((error) => {
  console.error('[db:apply-columns] Column migration failed');
  console.error(error);
  process.exitCode = 1;
});
