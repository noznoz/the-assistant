# Lulu — Running Project Checklist & Decision Log

## Build checklist
### Phase 1 (MVP) — ✅ complete & verified
- [x] Design system (tokens, components, dark/light, RTL)
- [x] i18n EN + AR with `dir` switching
- [x] Offline local store (CRUD, soft delete, export/import/wipe, seed)
- [x] Router + app shell + bottom nav + FAB
- [x] Today dashboard (brief, progress, stats, quick actions, attention lists)
- [x] Tasks & Requests (model, 7 views, actions, share, follow‑up draft)
- [x] Inbox capture + triage
- [x] Garage (cards + profile: overview/maintenance/expenses, share)
- [x] Expenses (ranges, category chart, budget, share)
- [x] People (+ WhatsApp), Documents (+ expiry), Trips (+ share)
- [x] Reports (daily/weekly/monthly + share)
- [x] Calendar agenda, Notifications feed
- [x] Settings (profile, language, currency, date format, theme, budget, security
      toggle, AI provider, backup/restore/delete)
- [x] Global search
- [x] PWA manifest + service worker (installable, offline)
- [x] `npm run build` passes · headless smoke test **ERROR_COUNT: 0**
- [x] Verified in dark mode and Arabic RTL

### Phase 2 — planned
- [ ] Supabase auth (email + Apple) · Face ID lock
- [ ] `supabaseAdapter.js` cloud sync · RLS policies
- [ ] Receipt OCR · file uploads · budgets & alerts · calendar groundwork · push

### Phase 3 — planned
- [ ] Lulu AI Assistant (Claude/OpenAI, preview‑before‑save) · voice · analytics ·
      PDF/Excel export · Siri Shortcuts

### Phase 4 — planned
- [ ] Family/assistant roles · web dashboard · Android · CarPlay · WhatsApp Business

## Technical decision log
| # | Decision | Why |
|---|---|---|
| 1 | **PWA (React/Vite) over Flutter** for v1 | Runs on iPhone today with no Mac/Xcode/$99 account; reuses this repo's working Supabase+PWA+Pages pipeline; Capacitor path to App Store later without a rewrite. |
| 2 | **Offline‑first localStorage** before cloud | App is instantly usable & private with zero setup; `db.js` seam lets Supabase slot in without UI changes. |
| 3 | **Context + custom hooks**, no Redux/Riverpod equivalent | Data volume is modest; keeps the bundle tiny and the code approachable for a beginner. |
| 4 | **Dependency‑free hash router** | Avoids extra deps/config; back‑button friendly; trivial to reason about. |
| 5 | **CSS variables design system** (no UI kit) | Original identity, full dark/RTL control, ~4 KB gzip CSS, no Material lock‑in. |
| 6 | **Offline heuristic "AI"** (`brief.js`, `triage.js`) | Real value with no key/cost now; returns the exact shape a Claude/OpenAI call will, so Phase 3 is a body swap. |
| 7 | **Single stroke icon set** in code | Consistent visual language, no icon‑font dependency, theme‑colored via `currentColor`. |
| 8 | **`{tables}` mirror local shape** | Phase 1→2 migration is a copy, not a redesign (see DATABASE.md). |
| 9 | Built on branch `claude/lulu-personal-os-app-v1k9wj` | Keeps the existing road‑heaven app on `main` untouched; Lulu owns this branch. |

## How to run / test after this milestone
```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build (dist/)
```
Then: try each bottom‑nav tab, add a task/expense/vehicle, switch to Arabic and dark
mode in Settings, and Export a backup. Everything works offline.
