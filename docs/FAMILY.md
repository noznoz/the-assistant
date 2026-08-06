# Family accounts

The app can be shared with family members. You (the person who first signs in and
creates the household) are the **admin/owner**; everyone you invite is a **member**.

## One-time setup (admin)

1. Run the cloud SQL once in your Supabase project (see `supabase/schema.sql`),
   then sign in under **More → Cloud & Family**. The first sign-in creates your
   household and makes you the owner.
2. **Deploy the app with your project's connection baked in** so invited members
   connect automatically without pasting any keys:

   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon/public key>
   ```

   The anon key is public by design (it only permits what your row-level-security
   rules allow), so it is safe to ship in the client. If you don't set these,
   members must enter the URL/key manually via *Advanced* on the login page.

## Inviting a family member

- **More → Cloud & Family → Invite family member.** On Android you can pick a
  phone contact; on iPhone (Apple blocks web access to contacts) it opens the
  WhatsApp share sheet so you choose the chat.
- The invite is a WhatsApp message with a **join link** (`…/#/join/<code>`). The
  link carries only the household code — never your project key.
- The member taps the link, lands on the **login page**, creates their own
  account (email + password), and is joined to your household automatically.

## What a member sees

A member gets a stripped-down app: **their profile** and **the tasks you assign
to them** — nothing else. Assign a task to them from the normal task editor
(they appear in the *Assigned to* list once they've joined).

Each member is represented by a `people` record that carries their login id, so
assigning a task to that person routes it to their account and into their
*My tasks* list. When they complete a task, it syncs back to you.

## Privacy model (Phase 1 → Phase 2)

The chosen model is **"their stuff + shared areas."**

- **Phase 1 (now):** a member's device only ever *requests* their own profile
  record and the tasks assigned to them. Sensitive areas — finances, documents,
  garage, etc. — are never synced to members at all. This is enforced by the app
  (the member client simply never asks for more).
- **Phase 2 (next):** the same rules enforced at the database with row-level
  security, plus an admin screen to explicitly share chosen areas (e.g. a shared
  calendar or trip). This is what makes the boundary robust against a technically
  savvy member, not just the app UI.

Until Phase 2's RLS is in place, treat member access as app-enforced, not
database-enforced.
