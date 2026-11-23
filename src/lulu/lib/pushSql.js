// SQL that switches on background push. Run once in Supabase → SQL Editor
// (safe to re-run). Background push itself lives in the lulu-mcp function and
// keeps its data in the records table, so this only schedules it every minute
// and lets the app's checklist see that it runs. The app shows it with the
// project address filled in (Reminders → Background reminders).
export const PUSH_URL_PLACEHOLDER = 'https://YOUR-PROJECT.supabase.co'

export function pushSetupSql(projectUrl = PUSH_URL_PLACEHOLDER) {
  const base = String(projectUrl || PUSH_URL_PLACEHOLDER).replace(/\/+$/, '').replace(/'/g, '')
  return `-- The Assistant — background push. Run once in Supabase → SQL Editor.

-- Run the push check every minute.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname in ('send-reminders-every-minute', 'lulu-push-every-minute');
select cron.schedule(
  'lulu-push-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url := '${base}/functions/v1/lulu-mcp/cron',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);

-- Lets the app's checklist see that the schedule runs. Read-only; only the
-- server function may call it.
create or replace function public.push_cron_status() returns jsonb
language sql security definer set search_path = public as $fn$
  select jsonb_build_object(
    'scheduled', exists (select 1 from cron.job where jobname = 'lulu-push-every-minute'),
    'last_status', (select status_code from net._http_response order by created desc limit 1),
    'last_at', (select created from net._http_response order by created desc limit 1)
  );
$fn$;
revoke all on function public.push_cron_status() from public, anon, authenticated;
grant execute on function public.push_cron_status() to service_role;`
}
