# Backlog — candidate next steps

Suggestions parked for later discussion. Not committed work; priorities are a
starting point, not a decision. Grouped by value/effort.

## In flight — finish what's started
- **Family privacy, Phase 2 (DB-enforced).** Today member privacy is
  *app-enforced* — a member's client simply never requests other data. Phase 2
  adds Supabase **row-level security** so the boundary holds even against direct
  API calls, plus an **admin "shared areas" screen** to explicitly share chosen
  areas (e.g. a shared calendar or trip). Completes the "their stuff + shared
  areas" model. (See `docs/FAMILY.md`, `docs/SECURITY.md`.)
- **Live-verify the cloud stack.** Auth, invite/join, and attachment
  upload/download are unit-tested against mocked fetch but never run against a
  real Supabase project. Do one real pass: deploy with `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`, invite a second account, confirm the member sees only
  their tasks. Also confirms PR #4 before/after merge.

## High-value new capability
- **Receipt scanning → expenses.** `lib/ocr.js` exists; wire a receipt photo
  (with the new crop/rotate editor) to auto-fill merchant / amount / date. Hits
  the PRD "capture in 3 seconds" goal.
- **Recurring tasks & bills that generate.** `lib/recurrence.js` exists and the
  notification feed already computes due dates, but nothing auto-creates the next
  occurrence. Make recurring items self-perpetuate.
- **Widen the AI assistant.** 6 confirm-before-act tools today; add *create
  trip*, *add document/renewal*, *log fuel with odometer* to make it a command
  bar over the data.

## Robustness / scale
- **Primary store → IndexedDB.** Writes are now quota-safe, but the ~5 MB
  localStorage ceiling remains (photos as data-URIs will hit it). The `db.js`
  seam is clean, so it's a contained swap.
- **Incremental / realtime sync.** Cloud pull is a full table scan every 20s;
  switch to `updated_at > lastSync` or Supabase Realtime (already used in the
  sibling app) to cut battery/bandwidth.

## Polish
- **Password reset + email confirmation** for family members (no "forgot
  password" today).
- **Pinch-to-zoom** in the photo editor (mobile) — currently slider/drag only.
- **Apple Sign-In / magic link** — smoother than passwords for family on iPhone.
- **Audit log** — `SECURITY.md` lists it unchecked; a per-entity change log for
  key records.

## Recommended order
1. Family privacy Phase 2 (real security implication).
2. Live-verification pass of the cloud stack.
3. Then pick from receipt OCR / recurring generation / assistant tools by daily value.
