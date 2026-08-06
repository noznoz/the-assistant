# Lulu — Technical Architecture

> **Implementation status (ahead of the phase plan below).** Several things this
> document describes as future seams are now built and shipping: **cloud sync +
> family sharing** over Supabase (`lib/cloud.js`, `store/StoreProvider.jsx`,
> `supabase/schema.sql`), the **AI assistant** with bring‑your‑own Anthropic key
> and confirm‑before‑act tools (`features/assistant`, `lib/ai.js`), and the
> **passcode + biometric app lock** (`ui/LockGate.jsx`, `lib/lock.js`). The
> `db.js` interface stayed stable throughout, exactly as intended.

## Stack
- **UI:** React 18 (functional components + hooks)
- **Build/dev:** Vite 6
- **PWA:** vite-plugin-pwa (service worker, installable, offline)
- **State:** React Context + custom hooks (light, no external state lib needed yet)
- **Routing:** tiny dependency‑free hash router (`lib/router.js`)
- **Persistence (Phase 1):** `localStorage` engine (`store/db.js`) — offline‑first
- **Persistence (Phase 2+):** Supabase (Postgres + Auth + Storage + Realtime) via a
  sync adapter that implements the same `db` interface — **no UI changes required**
- **Styling:** CSS custom properties (design tokens) + component CSS — theme‑aware
  (light/dark) and direction‑aware (LTR/RTL)
- **i18n:** in‑house string maps (EN/AR) + `dir` switching

## Clean Architecture layering
```
Presentation  →  features/*  (screens)  +  ui/*  (reusable components)
Application   →  store/*      (StoreProvider, hooks)  +  i18n, theme providers
Domain        →  lib/domain.js (entities/enums), lib/format, lib/brief, lib/triage
Data          →  store/db.js  (local engine)  →  [future] store/supabaseAdapter.js
```
Screens never touch storage directly — they call `useCollection(name)` /
`useSettings()`. That single seam is where cloud sync slots in later.

## Data flow
1. UI calls `useCollection('tasks').add({...})`.
2. `StoreProvider` writes through `db.insert()` (localStorage) and reloads that
   collection into React state → UI re‑renders.
3. **Phase 2:** the same call also enqueues a change for the Supabase adapter, which
   pushes on reconnect and reconciles via `updatedAt` (last‑write‑wins, per record).

## Folder structure
```
src/
  main.jsx                     # mounts <LuluApp/>
  lulu/
    LuluApp.jsx                # providers + router + shell
    lib/
      router.js                # hash router hook
      domain.js                # enums: types, statuses, priorities, categories…
      format.js                # money (SAR), dates, times, relative dates
      share.js                 # native/WhatsApp share + message formatters
      brief.js                 # offline "AI" morning brief
      triage.js                # offline "AI" inbox triage
    i18n/
      strings.js               # EN + AR dictionaries
      I18nProvider.jsx         # t(), lang, dir + <html dir/lang>
    theme/
      tokens.css               # design tokens (colours, radii, spacing, motion)
      components.css           # component styles
      ThemeProvider.jsx        # system/light/dark → <html data-theme>
    store/
      db.js                    # localStorage engine (CRUD, soft delete, export)
      StoreProvider.jsx        # React context + useCollection/useSettings
      seed.js                  # first‑launch sample data
    ui/
      Icon.jsx                 # single stroke‑icon set
      primitives.jsx           # Button, Card, Field, Sheet, Chip, Stat, Ring, Bars…
      AppShell.jsx             # TopBar + BottomNav
    features/
      today/ tasks/ inbox/ garage/ expenses/ people/
      documents/ trips/ reports/ notifications/ calendar/
      settings/ search/
```

## Extensibility seams (already in place)
- **Cloud sync:** implement `store/supabaseAdapter.js` with the same functions as
  `db.js`; `StoreProvider` chooses the backend by config. `useCollection` in the old
  road‑heaven code (`src/lib/useCollection.js`) shows the Supabase `{id,data}` +
  Realtime pattern to mirror.
- **AI provider:** `Settings → AI provider` already stores `none|claude|openai`.
  `brief.js` and `triage.js` return the exact shape a real API call will — swap the
  body, keep the UI.
- **Auth & lock:** `settings.requireLock` reserved for Face ID / passcode gate;
  Supabase Auth (email / Apple Sign‑In) drops in at the app root.
- **Files/receipts:** Document/Expense records reserve `fileUrl`/`receipt` fields for
  Supabase Storage in Phase 2.
- **Notifications:** the computed feed becomes push via Supabase Edge Functions
  (the repo already contains a `send-push` function to model this).

## Performance & offline
- All reads are synchronous from memory/localStorage → no loading spinners on
  navigation.
- Service worker precaches the app shell; the app is usable with no network.
- Bundle is code‑split‑ready; Phase 1 ships a single ~75 KB gzip bundle.
