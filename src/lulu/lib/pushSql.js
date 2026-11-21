// SQL that switches on background push for a Supabase project. Run once in
// Supabase → SQL Editor (safe to re-run). The app shows it with the project's
// own address filled in (Reminders → Background reminders → Check). Also kept
// as supabase/push-setup.sql. See docs/PUSH.md.
export const PUSH_URL_PLACEHOLDER = 'https://YOUR-PROJECT.supabase.co'

export function pushSetupSql(projectUrl = PUSH_URL_PLACEHOLDER) {
  const base = String(projectUrl || PUSH_URL_PLACEHOLDER).replace(/\/+$/, '').replace(/'/g, '')
  return `-- The Assistant — background push. Run once in Supabase → SQL Editor.

-- 1) Devices that receive push, per household.
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

-- 2) Alerts already sent (so each fires once).
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

-- 3) The push keys (made automatically by the send-reminders function) and
--    when it last ran. No policies: only the server function can read it.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text,
  private_key text,
  last_run_at timestamptz
);
alter table public.push_config enable row level security;

-- 4) Run send-reminders every minute.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'send-reminders-every-minute';
select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url := '${base}/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);

-- 5) Lets the app's checklist see whether the schedule runs and what the
--    function answered. Read-only; only the server function may call it.
create or replace function public.push_cron_status() returns jsonb
language sql security definer set search_path = public as $fn$
  select jsonb_build_object(
    'scheduled', exists (select 1 from cron.job where jobname = 'send-reminders-every-minute'),
    'last_status', (select status_code from net._http_response order by created desc limit 1),
    'last_at', (select created from net._http_response order by created desc limit 1)
  );
$fn$;
revoke all on function public.push_cron_status() from public, anon, authenticated;
grant execute on function public.push_cron_status() to service_role;`
}
