# Supabase RLS Policies

This folder holds the Supabase-specific security rules for the backend.

What lives here
- `rls-policies.sql` — idempotent Row Level Security policy script for Supabase and local PostgreSQL.

How it fits the hybrid setup
- Local development can keep using your local Postgres.
- Production can point at Supabase through `DB_STRATEGY=supabase`.
- Schema changes are still handled manually through Drizzle migrations.
- There is no automatic model sync on startup.

Important
- RLS policies only work when the table design supports them.
- The current backend keeps `public.users` private because it contains `password_hash`.
- User-owned tables use `user_id = auth.uid()` policies, and the local-only compatibility shim lives in `src/scripts/apply-rls.ts`.
- Apply the file with `npm run db:rls` or together with Drizzle schema changes via `npm run db:sync`.
- `npm run db:sync` runs a preflight cleanup first so Drizzle push does not trip over the old `nodes_mastery_check` constraint.



