-- =====================================================================
-- Riding Crew — Supabase schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY guards).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PROFILES  (members + rider profiles)
--   status: 'pending' | 'approved'      role: 'member' | 'admin'
--   `data` jsonb holds the rich rider profile (bio, album, garage, tags…)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  name        text not null default 'New Rider',
  status      text not null default 'pending',   -- pending | approved
  role        text not null default 'member',    -- member  | admin
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Shared collaborative entities. Each row stores the full object in `data`,
-- so the existing React UIs keep their exact shape. id is client-generated.
-- ---------------------------------------------------------------------
create table if not exists public.trips (
  id numeric primary key,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id numeric primary key,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id numeric primary key,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gear (
  id numeric primary key,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id numeric primary key,
  recipient_name text not null,         -- matches profiles.name
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INVITE CODES — anyone who signs up with a valid active code is
-- auto-approved (skips the admin queue).
-- ---------------------------------------------------------------------
create table if not exists public.invite_codes (
  code text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed one starter code (change/disable it later in the table editor)
insert into public.invite_codes (code) values ('RIDE-OR-DIE')
  on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

-- Auto-create a profile when a new auth user signs up.
-- The very first member becomes an approved admin (the crew founder).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, email, name, status, role, data)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when is_first then 'approved' else 'pending' end,
    case when is_first then 'admin'    else 'member'  end,
    coalesce(new.raw_user_meta_data->'data', '{}'::jsonb)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Redeem an invite code → approve the calling user. Called from the client.
-- Sets a transaction-local bypass flag so the escalation guard allows this
-- specific status change.
create or replace function public.redeem_invite(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (select 1 from public.invite_codes
                 where code = p_code and active) into ok;
  if ok then
    perform set_config('app.bypass_guard', 'on', true);
    update public.profiles set status = 'approved' where id = auth.uid();
  end if;
  return ok;
end;
$$;

-- Prevent privilege escalation: a non-admin cannot change their own
-- status/role by editing their profile directly. Admins can; the
-- redeem_invite() path sets a bypass flag for the one approval it performs.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status is distinct from old.status) or (new.role is distinct from old.role) then
    if coalesce(current_setting('app.bypass_guard', true), '') <> 'on'
       and not public.is_admin() then
      new.status := old.status;
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.trips         enable row level security;
alter table public.posts         enable row level security;
alter table public.challenges    enable row level security;
alter table public.gear          enable row level security;
alter table public.notifications enable row level security;
alter table public.invite_codes  enable row level security;

-- PROFILES: any authenticated user can read the roster; you can edit your
-- own profile (not your status/role); admins can edit anyone (approvals).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Generic helper macro pattern for the shared tables: approved members only.
-- TRIPS
drop policy if exists trips_rw on public.trips;
create policy trips_rw on public.trips
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- POSTS
drop policy if exists posts_rw on public.posts;
create policy posts_rw on public.posts
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- CHALLENGES
drop policy if exists challenges_rw on public.challenges;
create policy challenges_rw on public.challenges
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- GEAR
drop policy if exists gear_rw on public.gear;
create policy gear_rw on public.gear
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- NOTIFICATIONS
drop policy if exists notifications_rw on public.notifications;
create policy notifications_rw on public.notifications
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- INVITE CODES: readable by authenticated (the redeem RPC checks validity);
-- only admins can manage them.
drop policy if exists invite_select on public.invite_codes;
create policy invite_select on public.invite_codes
  for select to authenticated using (true);
drop policy if exists invite_admin on public.invite_codes;
create policy invite_admin on public.invite_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Realtime: broadcast row changes to subscribed clients
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.challenges;
alter publication supabase_realtime add table public.gear;
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------
-- STORAGE: public 'media' bucket for photos (avatars, albums, bikes, banners)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select to public using (bucket_id = 'media');

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_approved());

drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_approved());

-- Done. Create your account in the app — the first signup becomes admin.
