# Background reminders (web push)

Reminders and "due today" alerts normally fire while the app is open. With web
push they also arrive **when the app is closed**, plus a 7:30 morning brief.

Background push runs inside the **lulu-mcp** Edge Function (the same one the
Claude connector and the Apple Calendar feed use), so there is nothing extra to
deploy and no extra tables: device subscriptions, sent-alert bookkeeping and
the "last run" heartbeat are records in the `records` table (`_pushsub`,
`_pushalert`, `_pushcfg`). The push keys are derived from the project's own
service-role secret, so there are no keys to create (set `VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` secrets to use your own).

The app has a checklist: **More → Reminders → Background reminders**. Each line
gets a ✓ or says the one thing to do next.

## Setup (once)

1. **Deploy the newest lulu-mcp** — Supabase → Edge Functions → lulu-mcp →
   Code → paste the single-file build → Deploy. ("Verify JWT" stays off, as for
   the connector.)
2. **Schedule it every minute** — in the checklist tap **Push setup SQL → Copy
   SQL** (your project address is filled in), paste into Supabase → SQL Editor
   → Run. It enables `pg_cron` + `pg_net`, schedules `…/lulu-mcp/cron` every
   minute (replacing the older `send-reminders` job if there was one), and adds
   a read-only status function for the checklist. Safe to run again.
3. **On each device** — iPhone: open the app from its Home Screen icon. Then
   checklist → **Turn on** → Allow → **Send a test push**.

## What it sends

- **Reminders** at their times (up to 3 per reminder; repeating ones roll
  forward). Each is marked fired with `updatedAt` moved, so devices take the
  change and don't alert again.
- **Due today** (07:00–22:00 local only, never at night): tasks due/overdue,
  appointments, payments, document expiries, birthdays — once each.
- **Morning brief** once between 07:30 and 10:00.

`LULU_TZ` (default `Asia/Riyadh`) sets "today" and these windows. Tapping a
notification opens the screen it is about.

The older standalone `supabase/functions/send-reminders` is no longer needed.
