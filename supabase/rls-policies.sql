-- Supabase RLS policy starter file
-- Apply manually in Supabase SQL editor or via your migration workflow.
-- This project does not run automatic schema sync on startup.

-- Enable RLS on tables
alter table public.users enable row level security;
alter table public.nodes enable row level security;

-- Public read policy example
-- Use this only if the data is safe to expose to authenticated users.
create policy "users_select_authenticated"
on public.users
for select
to authenticated
using (true);

create policy "nodes_select_authenticated"
on public.nodes
for select
to authenticated
using (true);

-- Write policies below should be tightened to your app's ownership model.
-- Example placeholder:
-- create policy "users_insert_owner"
-- on public.users
-- for insert
-- to authenticated
-- with check (auth.uid() = owner_id);
