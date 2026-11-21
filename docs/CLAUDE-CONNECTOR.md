# Use The Assistant from Claude (text or voice)

Connect the app to Claude once, then just ask Claude, typed or spoken in voice
mode on your phone:

- “Add a dentist appointment on Sunday at 4 pm at Smile Clinic.”
- “Remind me tomorrow at 9 to call the bank.”
- “I spent 85 riyals at Al Baik.” · “Salary of 20,000 came in today.”
- “Add a task to renew the iqama by the 30th, high priority.”
- “What’s on today?” · “Mark ‘send the board pack’ as done.”
- “Move the dentist to 5:30.” · “Save a note: buy dates for the office.”
- Anything else in the app: trips, wishlist, goals, subscriptions, people, vehicles…

Claude asks for your OK before it changes anything (you can choose to always
allow). The change shows up on your phone within seconds while the app is open,
or the moment you switch back to it.

## How it works

```
Claude (phone, desktop, web)
   │  custom connector (MCP) — your private link
   ▼
lulu-mcp  ── Edge Function in YOUR Supabase project
   │  reads/writes the same `records` table the app syncs
   ▼
The Assistant on your phone  ── syncs on open, on return, every 20 s
```

Nothing passes through any other server: Claude talks to a function in your own
Supabase project, which only reaches your household’s data.

## One-time setup (about 10 minutes)

**0. Cloud sync must be on.** If it isn’t yet, follow `SETUP-CLOUD.md`
(More → Settings → Cloud & family in the app).

**1. Run the connector SQL.** In the app: More → Settings → Cloud & family → *Connect
Claude* → *Connector setup SQL* → Copy. In Supabase: **SQL Editor → New query**,
paste, **Run**. (It is also in `supabase/claude-connector.sql` and at the end of `supabase/schema.sql`. Safe to re-run.)

**2. Deploy the function.** Either way works:

- *Supabase CLI:* from this repository,
  ```
  supabase functions deploy lulu-mcp --no-verify-jwt
  ```
- *Dashboard:* **Edge Functions → Deploy a new function → Via editor**. Name it
  `lulu-mcp`. Replace the starter file with `supabase/functions/lulu-mcp/index.ts`,
  add a second file named `core.js` with `supabase/functions/lulu-mcp/core.js`,
  and deploy. Then open the function’s **Details** and turn **Verify JWT** off.

  “Verify JWT” must be off because Claude signs in with your private link, not
  with a Supabase login. The function checks the link itself.

Optional secrets (**Edge Functions → Secrets**): `LULU_TZ` (default
`Asia/Riyadh`) and `LULU_CURRENCY` (default `SAR`).

**3. Make your link.** In the app: More → Settings → Cloud & family → *Connect Claude* →
*Make a Claude link* → *Copy link*. It is shown only once.

**4. Add it to Claude.** On claude.ai (or the Claude app): **Settings →
Connectors → Add custom connector**. Name: `The Assistant`. URL: paste the link.
Leave sign-in as none. Save. It is now available in Claude everywhere you are
signed in, including voice mode on your phone.

## Keeping it private

- The link contains a secret key. Anyone who has it can use your data, so don’t
  share it. Only a fingerprint (SHA-256 hash) of the key is stored in Supabase.
- To cut access: More → Settings → Cloud & family → *Connect Claude* → **Remove** next to
  the link. Claude stops working with the app immediately; make a new link to
  reconnect.
- *Last used* next to each link shows when Claude last used it.
- Photos and document files are never sent to Claude; lists show `[file]`
  instead.

## What Claude can do

| Tool | What it does |
|---|---|
| `get_today` | Today’s date in your time zone, overdue/today tasks, appointments, reminders, month spend |
| `search`, `list_items` | Find or list anything in the app |
| `add_task`, `complete_task` | Tasks (repeating tasks continue, as in the app) |
| `add_appointment`, `add_reminder`, `add_note` | Calendar, alerts, notes |
| `add_expense`, `add_income` | Money in and out |
| `add_person` | People |
| `add_item` | Any other part of the app (trips, wishlist, goals, subscriptions…) |
| `update_item`, `delete_item` | Change or delete anything Claude found |

Records are written in exactly the shape the app’s own screens create (they are
marked `source: 'claude'`). Deletes are the app’s usual soft delete.

## Troubleshooting

- **Claude says it can’t connect / 401:** the link was removed or mistyped.
  Make a new one.
- **“Make a Claude link” says one-time setup:** step 1 (SQL) hasn’t been run.
- **Claude connects but the app doesn’t show the change:** check the phone is
  signed in to the same household (More → Settings → Cloud & family shows *Synced*), then
  pull down or tap *Sync now*.
- **Dashboard deploy fails to find `./core.js`:** the second file must be named
  exactly `core.js`, next to `index.ts`.
