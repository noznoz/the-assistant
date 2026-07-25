# Lulu — Development Roadmap

Built one milestone at a time. **Rule: never remove working functionality; each
phase adds on top.**

## Phase 1 — MVP  ✅ (this build)
Delivered and runnable now (offline, EN/AR, dark/light):
- App shell, bottom nav (Today, Tasks, Garage, Expenses, More), FAB, routing
- **Today** dashboard with offline AI morning brief + share agenda
- **Tasks & Requests** — full model, 7 views, complete/duplicate/delete, WhatsApp
  share, AI follow‑up draft
- **Inbox** capture + heuristic triage → task/note
- **Garage** — vehicle cards + full profile (specs, bio, insurance countdown,
  maintenance records, per‑vehicle expenses/total), WhatsApp share
- **Expenses** — model, ranges, category chart, budget bar, share
- **People**, **Documents** (w/ expiry), **Trips**, **Reports** (daily/weekly/
  monthly + share), **Calendar** (agenda), **Notifications** (live feed),
  **Settings** (profile, language, currency, theme, budget, security toggle, AI
  provider, export/import/wipe), **Global Search**
- Offline local storage + JSON backup/restore; PWA installable
- *Auth & cloud sync architected/stubbed (turn on in Phase 2)*

**Test now:** `npm install && npm run dev`. See `docs/README.md`.

## Phase 2 — Cloud, capture & reminders
- Supabase Auth (email + **Apple Sign‑In**) + Face ID / passcode lock
- `supabaseAdapter.js` → real cloud sync (offline‑first, last‑write‑wins)
- Receipt **scan** → auto‑extract merchant/date/total/category (OCR)
- Document/photo **file uploads** to Supabase Storage
- Category & monthly **budgets** with threshold alerts
- **Calendar integration** groundwork (Apple/Google) + push notifications
- Vehicle maintenance reminders; richer Arabic coverage & QA

## Phase 3 — Intelligence
- **Lulu AI Assistant** (Claude/OpenAI): natural‑language task & expense creation,
  morning brief, evening review, prioritisation, follow‑up drafting, vehicle bios,
  spend analysis, budget suggestions — **always with a preview before save/send**
- **Voice capture** → structured tasks
- Advanced expense analytics; **PDF / Excel / CSV** export
- **Siri Shortcuts**; advanced notification preferences & snooze

## Phase 4 — Scale
- **Family & assistant** roles (role‑based access, shared vehicles/trips/budgets)
- **Web dashboard** & Android polish
- Deep integrations: Gmail, Google Drive, Apple Reminders
- **CarPlay‑style** surfaces where permitted; **WhatsApp Business API** (official)
- Optional App Store build via **Capacitor** (same codebase)

## Sequencing principle
Ship value every phase; keep the `db.js` seam stable so cloud/AI slot in without UI
rewrites. Each milestone ends with: build passes, smoke test green, run instructions
updated in `README.md`, and a checklist tick in `CHECKLIST.md`.
