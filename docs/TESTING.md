# Lulu — Testing Strategy

## Layers
1. **Build gate** — `npm run build` must pass (type‑free React + Vite). Catches
   import/syntax errors across all 62 modules.
2. **Runtime smoke (automated)** — a headless Chromium (Playwright) loads every
   route, opens editors and a vehicle profile, and asserts **zero page/console
   errors**. Script lives in `docs/` guidance; re‑runnable any time (see below).
3. **Manual acceptance** — the checklist in this file, per module.
4. **Unit tests (Phase 2+)** — pure logic in `lib/` (`format`, `brief`, `triage`,
   share formatters) is written as pure functions specifically so they're trivially
   unit‑testable with Vitest.

## Run the smoke test
```bash
# terminal 1
PORT=5199 npm run dev
# terminal 2 (Playwright/Chromium is preinstalled in this environment)
node smoke.mjs      # loads all screens, prints ERROR_COUNT: 0
```

## Manual acceptance checklist
**Today** — greeting matches time of day; brief reflects real data; Share agenda
opens WhatsApp text; stat tiles navigate; quick actions open the right editor.
**Tasks** — create/edit/complete/duplicate/delete; each view filters correctly;
search matches title/assignee/project; WhatsApp share & follow‑up draft produce
clean text; overdue is flagged red.
**Inbox** — capture persists; triage moves item to Tasks/Notes with sensible type.
**Garage** — add/edit vehicle; profile tabs switch; add service; per‑vehicle
expenses total is correct; insurance countdown shows; share summary reads well.
**Expenses** — add/edit; range switch recomputes totals; category chart & budget
bar update; largest expense correct; share summary.
**People** — add/edit/delete; open‑item count per person; WhatsApp link dials the
number.
**Documents/Trips** — add/edit/delete; expiry countdown; trip share.
**Reports** — daily/weekly/monthly numbers match; share text correct.
**Notifications/Calendar** — feed & agenda reflect current data and navigate.
**Settings** — language flips UI + RTL; theme switches (incl. system); currency &
date format apply everywhere; **Export → Import** round‑trips; **Delete all** wipes
and reseeds is prevented (stays empty until reload).
**Cross‑cutting** — dark mode on every screen; Arabic RTL mirrors layout; offline
(airplane mode) still reads & writes; PWA installs to home screen.

## Regression rule
Before each commit: `npm run build` green **and** smoke `ERROR_COUNT: 0`.
Never delete a passing feature to make a new one work.
