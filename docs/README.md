# Lulu — Your Personal Operating System

Lulu is a premium personal productivity & lifestyle app: your day, work tasks &
requests, delegated follow‑ups, a digital garage for your cars/motorcycles/boats,
expenses, documents, trips, reminders and reports — with English & Arabic, dark &
light themes, and a calm, executive, Apple‑quality interface.

> **This is the Phase 1 build.** It runs **fully offline on your iPhone today** — no
> accounts, no cloud, no cost. Cloud sync (Supabase) is wired into the architecture
> and switched on later without rewriting anything.

---

## Why a PWA instead of Flutter?

You suggested Flutter; I recommended a **Progressive Web App (PWA)** built with the
React + Vite + Supabase pipeline that already lives in this repository. For your
goals this is genuinely the better first step:

| | PWA (chosen) | Flutter |
|---|---|---|
| On your iPhone today | ✅ "Add to Home Screen", full‑screen, offline | ❌ needs Mac + Xcode |
| Apple Developer account ($99/yr) | Not required for Phase 1 | Required to install |
| Live shareable URL | ✅ auto‑deploys | ❌ store review |
| App Store later | ✅ wrap with Capacitor, no rewrite | ✅ native |
| Reuses this repo's working setup | ✅ | ❌ start from zero |

If you later want a true App Store binary, we wrap the same code with **Capacitor** —
no rewrite. The whole architecture (Clean Architecture, offline‑first store, i18n,
design system) is framework‑agnostic.

---

## Run it on your computer (beginner steps)

You need **Node.js 18+** installed once (https://nodejs.org — pick "LTS").

```bash
# 1. Open a terminal inside this project folder (road-heaven)
# 2. Install the app's building blocks (first time only)
npm install

# 3. Start it
npm run dev
```

Then open the printed address (e.g. `http://localhost:5173`) in your browser.
Lulu starts with sample data so nothing looks empty. That's it — everything works.

## Put it on your iPhone

1. Deploy it (see below) to get a public `https://…` link, **or** on the same Wi‑Fi
   run `npm run dev -- --host` and open your computer's network address on the phone.
2. In **Safari**, open the link → tap the **Share** icon → **Add to Home Screen**.
3. Launch it from the home‑screen icon — it opens full‑screen like a native app.

## Deploy a live link (free)

This repo already builds to a static site (`npm run build` → `dist/`). Two easy hosts:

- **Vercel** — sign in with GitHub, "Import" this repo, framework = Vite. Done.
- **GitHub Pages** — a workflow already exists in `.github/`. Push to the branch and
  it publishes. (Set `VITE_BASE=/road-heaven/` for Pages; `/` for Vercel.)

## Your data & backups

Phase 1 stores everything **locally in your browser** (private to your device).
- **Settings → Export data** saves a `lulu-backup-….json` file.
- **Settings → Import data** restores it (e.g. on a new phone).
- **Settings → Delete all data** wipes everything (with confirmation).

---

## The documents in this folder

| File | What it is |
|---|---|
| `PRD.md` | Product requirements: vision, personas, features, journeys |
| `ARCHITECTURE.md` | Technical architecture & folder structure |
| `DATABASE.md` | Full data model + future Supabase schema |
| `DESIGN_SYSTEM.md` | Colours, type, components — the Lulu visual identity |
| `WIREFRAMES.md` | Text wireframes for every screen |
| `ROADMAP.md` | Phased plan (you are here: Phase 1) |
| `TESTING.md` | How each module is tested |
| `SECURITY.md` | Security & privacy checklist |
| `CHECKLIST.md` | Running build checklist + technical decision log |

## Required services & accounts

**Phase 1 (now): none.** It runs offline.

Later phases (optional, when you want them):

| Service | Used for | Free tier |
|---|---|---|
| GitHub | Code + auto‑deploy | Yes |
| Vercel **or** GitHub Pages | Hosting the live link | Yes |
| Supabase | Cloud sync, auth, file storage, push | Generous free tier |
| Anthropic (Claude) **or** OpenAI | AI assistant (Phase 3) | Pay‑as‑you‑go key |
| Apple Developer | App Store build via Capacitor (Phase 4) | $99/yr |
