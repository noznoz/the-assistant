# Background reminders (web push)

Personal reminders normally fire while the app is open. To have them arrive
**even when the app is closed**, set up web push. This needs cloud sync on, a
VAPID key pair, the `send-reminders` Edge Function on a schedule, and — on
iPhone — the app installed to the Home Screen.

Everything here is optional and self‑contained: with none of it configured the
app behaves exactly as before.

## 1. Generate VAPID keys (once)

```bash
npx web-push generate-vapid-keys
# → Public Key:  BEXXpH…   Private Key:  k9…
```

## 2. Client build

Set the **public** key at build time so the app can subscribe:

```
VITE_VAPID_PUBLIC_KEY=<public key>
```

(Alongside `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.) Rebuild/redeploy.

## 3. Database

Run `supabase/schema.sql` (it now includes the `push_subscriptions` table +
row‑level security). Safe to re‑run.

## 4. Edge Function

Deploy the sender and give it the secrets:

```bash
supabase functions deploy send-reminders

supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:you@example.com
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to functions automatically.
```

## 5. Schedule it (every minute)

Using `pg_cron` + `pg_net` (enable both extensions in the dashboard), schedule a
call to the function. Replace the URL and anon key:

```sql
select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url    := 'https://<project-ref>.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    )
  );
  $$
);
```

(Or invoke the function from any external cron / scheduler you prefer.)

## 6. On the phone

- Open the app → **More → Reminders → Background reminders → Enable** (grants
  notification permission and registers this device).
- **iPhone:** first add the app to the Home Screen (Share → *Add to Home
  Screen*), open it from there, then enable — iOS only allows web push for
  installed PWAs (iOS 16.4+).

## How it fits together

- The app stores each device's push subscription in `push_subscriptions`
  (`lib/push.js` → `cloud.savePushSubscription`).
- Reminders sync to the cloud as normal records (`collection = 'reminders'`).
- Every minute the Edge Function finds due reminders, pushes to the household's
  subscriptions, and marks each reminder `notified` so it fires once. The
  service worker (`src/sw.js`) shows the notification.
- The in‑app checker still fires reminders when the app is open; the shared
  `notified` flag prevents double‑firing.
