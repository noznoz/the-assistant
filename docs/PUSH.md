# Background reminders (web push)

Reminders and "due today" alerts normally fire while the app is open. With web
push they also arrive **when the app is closed**, plus a morning brief.

The app has a checklist for this: **More → Reminders → Background reminders**.
Each line gets a ✓ or tells you the one thing to do next, so you can follow it
instead of this page. The steps below are what it will ask for.

## 1. Deploy the `send-reminders` function (dashboard, no terminal)

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Replace the sample with `supabase/functions/send-reminders/index.ts` (one file).
3. Name it exactly `send-reminders`, then **Deploy function**.
4. Open its **Settings** tab, turn **Verify JWT** off and **Save changes**.
   The every-minute schedule calls it without a login; the function checks the
   caller itself wherever it matters (status and test pushes need the signed-in
   user, and only for their own household).

Already deployed an older version? Open it → **Code**, paste the new file over
it, **Deploy**, and make sure Verify JWT is off.

CLI alternative: `supabase functions deploy send-reminders --no-verify-jwt`.

**Push keys are made for you.** On first use the function generates a VAPID
key pair and keeps it in `push_config` (readable only by the server). If you
already set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` secrets, those are used
instead. The app asks the function for the public key, so the app no longer
needs `VITE_VAPID_PUBLIC_KEY` at build time (it is still used as a fallback).

## 2. Run the push setup SQL (once)

In the app's checklist tap **Push setup SQL → Copy SQL**: it has your project
address filled in. Paste it into Supabase → **SQL Editor → New query → Run**.
Safe to run again. It creates the push tables, enables `pg_cron` + `pg_net`,
schedules `send-reminders` every minute, and adds a small read-only status
function so the checklist can tell whether the schedule is running. (The same
SQL, with a placeholder address, is in `src/lulu/lib/pushSql.js`.)

## 3. On the phone

- **iPhone:** add the app to the Home Screen (Safari → Share → *Add to Home
  Screen*) and open it from that icon. iOS only allows push for Home Screen
  apps (iOS 16.4+).
- Checklist → **Turn on** → Allow. Then **Send a test push**.

## Optional secrets

`LULU_TZ` (default `Asia/Riyadh`) — your time zone for "today", the 07:30
morning brief and the daytime window (due-today alerts are sent 07:00–22:00,
never at night). `VAPID_SUBJECT` (defaults to your project URL).
`RESEND_API_KEY` + `BRIEF_FROM` to also email the morning brief.

## How it fits together

- Each device's push subscription is stored in `push_subscriptions`.
- Reminders sync as normal records (`collection = 'reminders'`).
- Every minute the function records a heartbeat (`push_config.last_run_at`),
  pushes due reminders, marks them fired (moving `updatedAt` too, so the phone
  takes the change and doesn't alert again), rolls repeating ones forward,
  sends daytime due-today alerts once each (`push_alerts`) and the morning
  brief. Dead subscriptions (404/410) are removed.
- The service worker (`src/sw.js`) shows the notification; tapping it opens
  the screen it is about.
