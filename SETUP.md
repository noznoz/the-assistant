# Riding Crew — Live shared setup (Supabase)

This turns the app into a real shared app with accounts, an admin-approval
gate, invite codes, and live data synced across everyone's phones.

## 1. Create the Supabase project
1. Go to https://supabase.com → **New project** (free tier is fine).
2. Pick a name + database password, wait ~2 min for it to provision.

## 2. Run the schema
1. In your project: **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this repo, copy everything, paste, **Run**.
   - Creates tables (profiles, trips, posts, challenges, notifications,
     invite_codes), Row-Level-Security policies, the admin-approval logic,
     Realtime, and a public `media` storage bucket for photos.
   - Seeds one invite code: **`RIDE-OR-DIE`** (change it later in Table Editor).

## 3. Add your keys
1. **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. Paste them into `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
3. Restart the dev server.

## 4. Auth providers
- **Email + password** works out of the box.
  - For a small crew, turn **off** email confirmation so people can sign in
    immediately: **Authentication → Providers → Email → uncheck "Confirm email"**.
    (Leave it on if you prefer verified emails — users just confirm via the link first.)
- **Google sign-in** (optional): **Authentication → Providers → Google → Enable**,
  then follow the inline instructions to add a Google OAuth client ID/secret
  (from Google Cloud Console) and the callback URL Supabase shows you.

## 5. First login = admin
The **first account** that signs up automatically becomes the crew **admin**
(approved + admin role). That's you. After that:
- New people **with the invite code** are approved instantly.
- New people **without** a code land in a **pending** queue — approve them from
  the header menu (your name ▾ → *Pending approvals*).

## 6. Deploy (so friends can reach it)
Build and host the static site anywhere (Vercel/Netlify/Cloudflare Pages):
```
npm run build      # outputs dist/
```
Set the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars in your host.
Because it's a PWA, everyone can "Add to Home Screen" for an app-like icon.

## 7. Push notifications (iPhone & Android)

The app creates in-app notifications for new posts, new rides, ride photos,
ride comments, replies, and challenge events. To also deliver them as real
phone push notifications, wire up the pipeline once:

### a. VAPID keys
Generate a key pair (or use `npx web-push generate-vapid-keys`):
- **Public key** → set as `VITE_VAPID_PUBLIC_KEY` in your hosting env
  (Vercel: Project → Settings → Environment Variables), then **redeploy**.
  Without it the "Enable notifications" button stays hidden in the app menu.
- **Private key** → never goes in the repo; it's a Supabase secret (next step).

### b. Deploy the send-push Edge Function
With the [Supabase CLI](https://supabase.com/docs/guides/cli) logged in:
```
supabase link --project-ref <YOUR_PROJECT_REF>
supabase secrets set VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key>
supabase functions deploy send-push --no-verify-jwt
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

### c. Fire it on every new notification
In the Supabase dashboard: **Database → Webhooks → Create a new hook**
- Name: `push-on-notification` · Table: `notifications` · Events: **Insert**
- Type: **Supabase Edge Function** → pick `send-push`
- Create. Every notification row inserted now triggers a push to that rider's
  subscribed devices.

### d. What each rider does on their phone (iOS requirements)
1. iPhone must be on **iOS 16.4 or newer**.
2. Open the site in Safari → Share → **Add to Home Screen** (pushes only work
   from the installed app, never from a Safari tab).
3. Open the installed app → header menu (name ▾) → tap **🔔 Enable notifications**
   and accept the permission prompt.

Android/Chrome works the same way but without the Home-Screen requirement.

## 8. Google Maps (free, Embed-only setup)

Trip pages show live route/meeting-point maps via the **Maps Embed API**,
which Google offers **free with unlimited usage**. You don't need the paid
Places API — the trip form's location autocomplete falls back to free
OpenStreetMap search automatically.

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project → **APIs & Services → Library** → enable **Maps Embed API** only.
2. **Credentials → Create credentials → API key.** Edit the key:
   - Website restriction: your domain (e.g. `road-heaven.vercel.app/*`)
   - API restriction: **Maps Embed API** only (so the key is worthless if leaked)
3. In your hosting env set both, then redeploy:
   ```
   VITE_GOOGLE_MAPS_KEY=<your key>
   VITE_GOOGLE_MAPS_EMBED_ONLY=1
   ```

Want Google's own autocomplete instead of OpenStreetMap's? Also enable
**Maps JavaScript API** + **Places API** on the key and remove
`VITE_GOOGLE_MAPS_EMBED_ONLY`. (Requires billing enabled on the Google Cloud
project; ~10k autocomplete calls/month are free.)

---

### Notes / current limits
- All shared data is stored as JSON rows, so the UI you already have keeps its
  exact shape — trips, posts, challenges, notifications and profiles are now live.
- Photos upload to the public `media` bucket and get permanent URLs.
- Challenge **invites** currently list a fixed set of names; wiring them to the
  live roster is a small follow-up.
