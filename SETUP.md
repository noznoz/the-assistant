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

---

### Notes / current limits
- All shared data is stored as JSON rows, so the UI you already have keeps its
  exact shape — trips, posts, challenges, notifications and profiles are now live.
- Photos upload to the public `media` bucket and get permanent URLs.
- Challenge **invites** currently list a fixed set of names; wiring them to the
  live roster is a small follow-up.
