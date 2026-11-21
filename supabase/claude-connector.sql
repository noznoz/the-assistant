-- The Assistant — Claude connector. Run once in Supabase → SQL Editor.

-- Connector keys. Only the SHA-256 hash of each key is stored; a key opens
-- exactly one household.
create table if not exists public.assistant_keys (
  key_hash text primary key,
  household_id uuid not null references public.households on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.assistant_keys enable row level security;
drop policy if exists ak_member_all on public.assistant_keys;
create policy ak_member_all on public.assistant_keys
  for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- Never let an older copy of a record overwrite a newer one (a phone that has
-- not synced yet racing a change Claude or another device just made).
create or replace function public.records_keep_newest() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then
    return null;  -- skip this write; the stored copy is newer
  end if;
  return new;
end $$;
drop trigger if exists records_keep_newest on public.records;
create trigger records_keep_newest before update on public.records
  for each row execute function public.records_keep_newest();
