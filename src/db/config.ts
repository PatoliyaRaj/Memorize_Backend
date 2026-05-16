export type DatabaseStrategy = 'local' | 'supabase' | 'fallback';

export type DatabaseCandidate = {
  name: 'local' | 'supabase';
  connectionString: string;
};

const normalizeConnectionString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  // Handle accidental "DATABASE_URL=..." values in env vars
  const match = trimmed.match(/^DATABASE_URL\s*=\s*"?(.+?)"?$/i);
  if (match?.[1]) return match[1].trim();

  return trimmed;
};

const normalizeStrategy = (value: string | undefined): DatabaseStrategy => {
  if (value === 'local' || value === 'supabase' || value === 'fallback') return value;
  // Auto-select based on NODE_ENV if DB_STRATEGY not set
  return process.env.NODE_ENV === 'production' ? 'supabase' : 'local';
};

export const getDatabaseStrategy = (): DatabaseStrategy =>
  normalizeStrategy(process.env.DB_STRATEGY);

export const getDatabaseCandidates = (): DatabaseCandidate[] => {
  // Support multiple env var names for backwards compatibility
  const localUrl = normalizeConnectionString(process.env.POSTGRES_URL);
  const supabaseUrl =
    normalizeConnectionString(process.env.SUPABASE_DB_URL) ??
    normalizeConnectionString(process.env.DATABASE_URL);

  const strategy = getDatabaseStrategy();

  if (strategy === 'local') {
    return [{ name: 'local', connectionString: localUrl ?? '' }];
  }

  if (strategy === 'supabase') {
    return [{ name: 'supabase', connectionString: supabaseUrl ?? '' }];
  }

  // fallback: try local first, then supabase
  return [
    { name: 'local', connectionString: localUrl ?? '' },
    { name: 'supabase', connectionString: supabaseUrl ?? '' },
  ];
};

/**
 * Returns the active connection string.
 * Picks the first candidate with a non-empty URL.
 */
export const resolveDatabaseConnectionString = (): string => {
  const candidates = getDatabaseCandidates();
  const selected = candidates.find((c) => c.connectionString.length > 0);

  if (!selected) {
    throw new Error(
      'No database connection string configured. Set POSTGRES_URL (local) or SUPABASE_DB_URL (Supabase).'
    );
  }

  return selected.connectionString;
};

export const getResolvedDatabaseTarget = (): 'local' | 'supabase' => {
  const strategy = getDatabaseStrategy();
  if (strategy === 'supabase') return 'supabase';
  if (strategy === 'fallback') {
    return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL ? 'supabase' : 'local';
  }
  return 'local';
};

/**
 * Pool settings — postgres-js uses seconds for timeouts, not ms.
 * We keep ms here for API consistency; connection.ts converts them.
 */
export const getPoolSettings = () => ({
  max: Number(process.env.PG_POOL_MAX ?? 20),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MILLIS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MILLIS ?? 10_000),
});
