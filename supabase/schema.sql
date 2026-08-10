-- =====================================================================
-- The Assistant ("Lulu") — Supabase schema for cloud sync + family sharing.
--
-- Run this once in your own Supabase project: SQL Editor → New query →
-- paste → Run. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE guards).
--
-- Model: the app keeps every record as a JSON object locally (see
-- src/lulu/store/db.js). When cloud sync is on, each record is mirrored into
-- one shared `records` table as JSONB, scoped to a `household`. Family members
-- each sign in with their own account and join a household by its code (the
-- household UUID). This is the schema src/lulu/lib/cloud.js talks to — it is the
-- canonical copy of the SQL also shown in-app under More → Cloud & Family.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Households (a shared data space) + their members.
-- ---------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  email text,
  role text not null default 'member',   -- owner | member
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ---------------------------------------------------------------------
-- One row per synced record. `id` is the client-generated record id; the full
-- object (including createdAt/updatedAt/deletedAt) lives in `data`, so the React
-- UI keeps its exact shape and soft-deletes sync like any other change.
-- ---------------------------------------------------------------------
create table if not exists public.records (
  household_id uuid references public.households on delete cascade,
  id text not null,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

-- Incremental-pull support: fetch only what changed since last sync.
create index if not exists records_household_updated_idx
  on public.records (household_id, updated_at);

-- ---------------------------------------------------------------------
-- Row Level Security — a user can only touch households they belong to.
-- ---------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.records           enable row level security;

-- Is the current user a member of household `h`? SECURITY DEFINER so the policy
-- can check membership without recursing through the members table's own RLS.
create or replace function public.is_member(h uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

drop policy if exists hm_self_read on public.household_members;
create policy hm_self_read on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_member(household_id));

drop policy if exists hm_self_join on public.household_members;
create policy hm_self_join on public.household_members
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists hh_member_read on public.households;
create policy hh_member_read on public.households
  for select to authenticated using (public.is_member(id));

drop policy if exists hh_create on public.households;
create policy hh_create on public.households
  for insert to authenticated with check (true);

drop policy if exists rec_member_all on public.records;
create policy rec_member_all on public.records
  for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- ---------------------------------------------------------------------
-- STORAGE (optional): private 'attachments' bucket for document/receipt files.
-- Document metadata syncs via `records`; the binaries can be uploaded here so
-- they follow you across devices. Objects are namespaced by household id
-- (path = "<household_id>/<file>") and only members of that household may
-- read/write them. Signed URLs are used to read (bucket is private).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

drop policy if exists attach_member_read on storage.objects;
create policy attach_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments'
         and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists attach_member_write on storage.objects;
create policy attach_member_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments'
              and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists attach_member_update on storage.objects;
create policy attach_member_update on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments'
         and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists attach_member_delete on storage.objects;
create policy attach_member_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments'
         and public.is_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS (optional) — background reminders while the app is closed.
-- One row per device; the send-reminders Edge Function pushes to these. See
-- docs/PUSH.md for the full setup (VAPID keys, function deploy, pg_cron).
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (household_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists ps_member_all on public.push_subscriptions;
create policy ps_member_all on public.push_subscriptions
  for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- Background-alert de-duplication: one row per (household, alert_key) that has
-- already been pushed, so the send-reminders function alerts about each dated
-- item (task due, appointment, expiry, birthday) exactly once. Keys embed the
-- item's date, so a changed/renewed date naturally re-arms the alert.
create table if not exists public.push_alerts (
  household_id uuid references public.households on delete cascade,
  alert_key text not null,
  sent_at timestamptz not null default now(),
  primary key (household_id, alert_key)
);
alter table public.push_alerts enable row level security;
drop policy if exists pa_member_all on public.push_alerts;
create policy pa_member_all on public.push_alerts
  for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- Done. In the app: More → Cloud & Family → paste your project URL + anon key,
-- tick the privacy consent, then create an account or sign in.
