# Supabase RLS Policies

This folder holds the Supabase-specific security rules for the backend.

What lives here
- `rls-policies.sql` — starter Row Level Security policy template for Supabase.

How it fits the hybrid setup
- Local development can keep using your local Postgres.
- Production can point at Supabase through `DB_STRATEGY=supabase`.
- Schema changes are still handled manually through Drizzle migrations.
- There is no automatic model sync on startup.

Important
- RLS policies only work when the table design supports them.
- If you want per-user access control, add an ownership column such as `user_id` or `owner_id` and reference Supabase auth claims in the policy.
