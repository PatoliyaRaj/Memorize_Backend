-- Hybrid RLS policy file for the Memorize backend.
--
-- How to use:
--   - Apply through `npm run db:rls` for the currently selected database.
--   - Or run it directly in Supabase SQL editor / local PostgreSQL.
--
-- Security model:
--   - `public.users` stays backend-only because it contains `password_hash`.
--   - User-owned tables are restricted to the owning `user_id`.

-- -----------------------------------------------------------------------------
-- Core table posture
-- -----------------------------------------------------------------------------

alter table if exists public.users enable row level security;
alter table if exists public.user_profiles enable row level security;
alter table if exists public.baskets enable row level security;
alter table if exists public.subjects enable row level security;
alter table if exists public.playlists enable row level security;
alter table if exists public.nodes enable row level security;
alter table if exists public.node_details enable row level security;
alter table if exists public.edges enable row level security;
alter table if exists public.cards enable row level security;
alter table if exists public.card_states enable row level security;
alter table if exists public.reviews enable row level security;
alter table if exists public.sleep_logs enable row level security;
alter table if exists public.study_sessions enable row level security;
alter table if exists public.pulse_queues enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.sleep_alerts enable row level security;
alter table if exists public.push_subscriptions enable row level security;

-- Keep the users table private. It stores password hashes, so it should not be
-- readable by direct authenticated client access.

-- -----------------------------------------------------------------------------
-- Helper pattern: owner-only rows
-- -----------------------------------------------------------------------------

drop policy if exists "user_profiles_select_owner" on public.user_profiles;
drop policy if exists "user_profiles_insert_owner" on public.user_profiles;
drop policy if exists "user_profiles_update_owner" on public.user_profiles;
drop policy if exists "user_profiles_delete_owner" on public.user_profiles;

create policy "user_profiles_select_owner"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "user_profiles_insert_owner"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_profiles_update_owner"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_profiles_delete_owner"
on public.user_profiles
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "baskets_select_owner" on public.baskets;
drop policy if exists "baskets_insert_owner" on public.baskets;
drop policy if exists "baskets_update_owner" on public.baskets;
drop policy if exists "baskets_delete_owner" on public.baskets;

create policy "baskets_select_owner"
on public.baskets
for select
to authenticated
using (user_id = auth.uid());

create policy "baskets_insert_owner"
on public.baskets
for insert
to authenticated
with check (user_id = auth.uid());

create policy "baskets_update_owner"
on public.baskets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "baskets_delete_owner"
on public.baskets
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "subjects_select_owner" on public.subjects;
drop policy if exists "subjects_insert_owner" on public.subjects;
drop policy if exists "subjects_update_owner" on public.subjects;
drop policy if exists "subjects_delete_owner" on public.subjects;

create policy "subjects_select_owner"
on public.subjects
for select
to authenticated
using (user_id = auth.uid());

create policy "subjects_insert_owner"
on public.subjects
for insert
to authenticated
with check (user_id = auth.uid());

create policy "subjects_update_owner"
on public.subjects
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "subjects_delete_owner"
on public.subjects
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "playlists_select_owner" on public.playlists;
drop policy if exists "playlists_insert_owner" on public.playlists;
drop policy if exists "playlists_update_owner" on public.playlists;
drop policy if exists "playlists_delete_owner" on public.playlists;

create policy "playlists_select_owner"
on public.playlists
for select
to authenticated
using (user_id = auth.uid());

create policy "playlists_insert_owner"
on public.playlists
for insert
to authenticated
with check (user_id = auth.uid());

create policy "playlists_update_owner"
on public.playlists
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "playlists_delete_owner"
on public.playlists
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "nodes_select_owner" on public.nodes;
drop policy if exists "nodes_insert_owner" on public.nodes;
drop policy if exists "nodes_update_owner" on public.nodes;
drop policy if exists "nodes_delete_owner" on public.nodes;

create policy "nodes_select_owner"
on public.nodes
for select
to authenticated
using (user_id = auth.uid());

create policy "nodes_insert_owner"
on public.nodes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "nodes_update_owner"
on public.nodes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "nodes_delete_owner"
on public.nodes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "node_details_select_owner" on public.node_details;
drop policy if exists "node_details_insert_owner" on public.node_details;
drop policy if exists "node_details_update_owner" on public.node_details;
drop policy if exists "node_details_delete_owner" on public.node_details;

create policy "node_details_select_owner"
on public.node_details
for select
to authenticated
using (
	exists (
		select 1
		from public.nodes n
		where n.id = node_id
			and n.user_id = auth.uid()
	)
);

create policy "node_details_insert_owner"
on public.node_details
for insert
to authenticated
with check (
	exists (
		select 1
		from public.nodes n
		where n.id = node_id
			and n.user_id = auth.uid()
	)
);

create policy "node_details_update_owner"
on public.node_details
for update
to authenticated
using (
	exists (
		select 1
		from public.nodes n
		where n.id = node_id
			and n.user_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.nodes n
		where n.id = node_id
			and n.user_id = auth.uid()
	)
);

create policy "node_details_delete_owner"
on public.node_details
for delete
to authenticated
using (
	exists (
		select 1
		from public.nodes n
		where n.id = node_id
			and n.user_id = auth.uid()
	)
);

drop policy if exists "edges_select_owner" on public.edges;
drop policy if exists "edges_insert_owner" on public.edges;
drop policy if exists "edges_update_owner" on public.edges;
drop policy if exists "edges_delete_owner" on public.edges;

create policy "edges_select_owner"
on public.edges
for select
to authenticated
using (user_id = auth.uid());

create policy "edges_insert_owner"
on public.edges
for insert
to authenticated
with check (user_id = auth.uid());

create policy "edges_update_owner"
on public.edges
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "edges_delete_owner"
on public.edges
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "cards_select_owner" on public.cards;
drop policy if exists "cards_insert_owner" on public.cards;
drop policy if exists "cards_update_owner" on public.cards;
drop policy if exists "cards_delete_owner" on public.cards;

create policy "cards_select_owner"
on public.cards
for select
to authenticated
using (user_id = auth.uid());

create policy "cards_insert_owner"
on public.cards
for insert
to authenticated
with check (user_id = auth.uid());

create policy "cards_update_owner"
on public.cards
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cards_delete_owner"
on public.cards
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "card_states_select_owner" on public.card_states;
drop policy if exists "card_states_insert_owner" on public.card_states;
drop policy if exists "card_states_update_owner" on public.card_states;
drop policy if exists "card_states_delete_owner" on public.card_states;

create policy "card_states_select_owner"
on public.card_states
for select
to authenticated
using (user_id = auth.uid());

create policy "card_states_insert_owner"
on public.card_states
for insert
to authenticated
with check (user_id = auth.uid());

create policy "card_states_update_owner"
on public.card_states
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "card_states_delete_owner"
on public.card_states
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "reviews_select_owner" on public.reviews;
drop policy if exists "reviews_insert_owner" on public.reviews;
drop policy if exists "reviews_update_owner" on public.reviews;
drop policy if exists "reviews_delete_owner" on public.reviews;

create policy "reviews_select_owner"
on public.reviews
for select
to authenticated
using (user_id = auth.uid());

create policy "reviews_insert_owner"
on public.reviews
for insert
to authenticated
with check (user_id = auth.uid());

create policy "reviews_update_owner"
on public.reviews
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "reviews_delete_owner"
on public.reviews
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "sleep_logs_select_owner" on public.sleep_logs;
drop policy if exists "sleep_logs_insert_owner" on public.sleep_logs;
drop policy if exists "sleep_logs_update_owner" on public.sleep_logs;
drop policy if exists "sleep_logs_delete_owner" on public.sleep_logs;

create policy "sleep_logs_select_owner"
on public.sleep_logs
for select
to authenticated
using (user_id = auth.uid());

create policy "sleep_logs_insert_owner"
on public.sleep_logs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "sleep_logs_update_owner"
on public.sleep_logs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "sleep_logs_delete_owner"
on public.sleep_logs
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "study_sessions_select_owner" on public.study_sessions;
drop policy if exists "study_sessions_insert_owner" on public.study_sessions;
drop policy if exists "study_sessions_update_owner" on public.study_sessions;
drop policy if exists "study_sessions_delete_owner" on public.study_sessions;

create policy "study_sessions_select_owner"
on public.study_sessions
for select
to authenticated
using (user_id = auth.uid());

create policy "study_sessions_insert_owner"
on public.study_sessions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "study_sessions_update_owner"
on public.study_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "study_sessions_delete_owner"
on public.study_sessions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "pulse_queues_select_owner" on public.pulse_queues;
drop policy if exists "pulse_queues_insert_owner" on public.pulse_queues;
drop policy if exists "pulse_queues_update_owner" on public.pulse_queues;
drop policy if exists "pulse_queues_delete_owner" on public.pulse_queues;

create policy "pulse_queues_select_owner"
on public.pulse_queues
for select
to authenticated
using (user_id = auth.uid());

create policy "pulse_queues_insert_owner"
on public.pulse_queues
for insert
to authenticated
with check (user_id = auth.uid());

create policy "pulse_queues_update_owner"
on public.pulse_queues
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "pulse_queues_delete_owner"
on public.pulse_queues
for delete
to authenticated
using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- notifications policies
-- -----------------------------------------------------------------------------
drop policy if exists "notifications_select_owner" on public.notifications;
drop policy if exists "notifications_insert_owner" on public.notifications;
drop policy if exists "notifications_update_owner" on public.notifications;
drop policy if exists "notifications_delete_owner" on public.notifications;

create policy "notifications_select_owner"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_insert_owner"
on public.notifications
for insert
to authenticated
with check (user_id = auth.uid());

create policy "notifications_update_owner"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_delete_owner"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- sleep_alerts policies
-- -----------------------------------------------------------------------------
drop policy if exists "sleep_alerts_select_owner" on public.sleep_alerts;
drop policy if exists "sleep_alerts_insert_owner" on public.sleep_alerts;
drop policy if exists "sleep_alerts_update_owner" on public.sleep_alerts;
drop policy if exists "sleep_alerts_delete_owner" on public.sleep_alerts;

create policy "sleep_alerts_select_owner"
on public.sleep_alerts
for select
to authenticated
using (user_id = auth.uid());

create policy "sleep_alerts_insert_owner"
on public.sleep_alerts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "sleep_alerts_update_owner"
on public.sleep_alerts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "sleep_alerts_delete_owner"
on public.sleep_alerts
for delete
to authenticated
using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- push_subscriptions policies
-- -----------------------------------------------------------------------------
drop policy if exists "push_subscriptions_select_owner" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_owner" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_owner" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_owner" on public.push_subscriptions;

create policy "push_subscriptions_select_owner"
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

create policy "push_subscriptions_insert_owner"
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_subscriptions_update_owner"
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_subscriptions_delete_owner"
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());
