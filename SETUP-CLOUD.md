# Cloud sync + family — setup (Supabase)

The Assistant is offline-first: all data lives on each device. Turn on cloud sync
to share the same data across your own devices and with family — using **your own**
free Supabase project. Nothing goes to any third party.

## 1. Create a free project
1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine).
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcd.supabase.co`)
   - **anon public** key

## 2. Run the setup SQL (once)
Open **SQL Editor → New query**, paste the block below, and **Run**. (The exact same
SQL is available in-app under Settings → Cloud & family → *Show setup SQL*.)

```sql
create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now()
);
create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  email text, role text default 'member',
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);
create table if not exists public.records (
  household_id uuid references public.households on delete cascade,
  id text not null,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;

create or replace function public.is_member(h uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.household_members
    where household_id = h and user_id = auth.uid());
$$;

create policy hm_self_read on public.household_members
  for select using (user_id = auth.uid() or public.is_member(household_id));
create policy hm_self_join on public.household_members
  for insert with check (user_id = auth.uid());
create policy hh_member_read on public.households
  for select using (public.is_member(id));
create policy hh_create on public.households
  for insert with check (true);
create policy rec_member_all on public.records
  for all using (public.is_member(household_id))
  with check (public.is_member(household_id));
```

## 3. Connect the app
In the app: **Settings → Cloud & family**.
1. Paste the **Project URL** and **anon key**, tap *Save project*.
2. **Create account** (or Sign in) with an email + password.
   - Optional: in Supabase **Authentication → Providers → Email**, turn *Confirm email* off
     for the smoothest experience, or confirm via the email you receive.
3. Your data now syncs automatically (on open + every few seconds while open).

## 4. Add family
Each family member installs the app, connects the **same** Project URL + anon key,
and creates their **own** account. Then:
- The first person opens **Cloud & family** and copies the **household code**.
- Everyone else pastes it under **Join a household**.

Everyone in a household sees and edits the same data. Row-level security ensures a
project's data is only ever visible to its own household members.

## How sync works
- Every record is stored as JSON in a single `records` table, scoped to a household.
- The app pushes each change as you make it and pulls remote changes on open and on a
  short interval. Conflicts resolve last-write-wins by each record's `updatedAt`.
- Device-only settings (theme, API keys, prayer city) stay local and are never synced.
