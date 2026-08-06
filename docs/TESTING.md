# Lulu — Testing Strategy

## Layers
1. **Build gate** — `npm run build` must pass (type‑free React + Vite). Catches
   import/syntax errors across every module.
2. **Unit tests (Vitest)** — `npm test` runs the pure‑logic suite in
   `src/lulu/**/*.test.js`: currency/date formatting (`format`), the local store's
   CRUD + last‑write‑wins `mergeRemote` + quota‑safe writes (`db`), and the
   assistant context builder. Add tests alongside new pure functions.
3. **Runtime smoke (automated)** — `node smoke.mjs` builds nothing itself; run
   `npm run smoke` (build + smoke) to launch a headless Chromium that loads **every
   route** and asserts **zero page/console errors**. Prints `ERROR_COUNT: 0` on
   success.
4. **Manual acceptance** — the checklist in this file, per module.

All three automated layers run on every push/PR via `.github/workflows/ci.yml`.

## Run the tests
```bash
npm test           # unit tests (Vitest, jsdom)
npm run smoke      # build + headless-Chromium route smoke; prints ERROR_COUNT: 0
```
The smoke script serves the built `dist/` itself and finds Chromium via
`PLAYWRIGHT_BROWSERS_PATH` (falling back to `/opt/pw-browsers/chromium`); in CI,
`npx playwright install chromium` provides it.

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
