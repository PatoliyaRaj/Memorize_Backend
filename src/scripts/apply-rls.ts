import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { getDatabaseStrategy, resolveDatabaseConnectionString, getPoolSettings } from '@/db/config';

const resolveRlsFilePath = (): string => {
  const overridePath = process.argv[2]?.trim();
  if (overridePath) {
    return path.resolve(process.cwd(), overridePath);
  }

  return path.resolve(__dirname, '../../supabase/rls-policies.sql');
};

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
      application_name: `memorize-rls-${process.env.NODE_ENV ?? 'development'}`,
    },
  });
};

const localCompatibilitySql = `
create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

do $$
begin
  if not exists (
    select 1
    from pg_roles
    where rolname = 'authenticated'
  ) then
    execute 'create role authenticated';
  end if;
end
$$;
`;

const main = async () => {
  const filePath = resolveRlsFilePath();
  const sqlText = await fs.readFile(filePath, 'utf8');
  const client = createClient();

  try {
    const strategy = getDatabaseStrategy();
    console.log(`[db:rls] Applying ${path.basename(filePath)} using ${strategy} connection`);
    if (strategy === 'local') {
      await client.unsafe(localCompatibilitySql);
    }
    await client.unsafe(sqlText);
    console.log('[db:rls] RLS policy script applied successfully');
  } finally {
    await client.end({ timeout: 5 });
  }
};

main().catch((error) => {
  console.error('[db:rls] Failed to apply RLS policies');
  console.error(error);
  process.exitCode = 1;
});