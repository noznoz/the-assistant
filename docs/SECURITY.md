# Lulu — Security & Privacy Checklist

Lulu holds sensitive personal, financial, work and vehicle data. Security is a
first‑class requirement, phased alongside features.

## Phase 1 (now)
- [x] **Local‑only by default** — all data stays in the browser's `localStorage` on
      the device; nothing leaves it without an explicit action.
- [x] **No third‑party analytics / trackers**; no external network calls at runtime.
- [x] **No AI data sharing** — the "AI" brief & triage run **offline**; the AI
      provider setting defaults to `none`.
- [x] **User‑controlled data** — Export (backup), Import (restore), Delete‑all
      (with confirmation) in Settings.
- [x] **Share is explicit** — content only leaves via the OS share sheet when the
      user taps share.
- [x] **Security lock setting** reserved (`requireLock`) for Phase 2 biometric gate.

## Phase 2 (cloud on)
- [x] Supabase **Auth**: email/password sign‑in + sign‑up (`lib/cloud.js`).
      *(Magic‑link / Apple Sign‑In still to come.)*
- [x] **Row Level Security** — every synced row lives in the shared `records`
      table scoped to a `household`; policies allow access only to members of that
      household (`is_member()`), and members join by the household code. Canonical
      DDL: **`supabase/schema.sql`** (also shown in‑app).
- [x] **Passcode + Face ID / Touch ID** app lock with **auto‑lock** on background
      (`ui/LockGate.jsx`, `lib/lock.js`). *Note: biometric unlock is a presence
      check over the passcode fallback, not a cryptographic assertion.*
- [x] **In transit** over TLS (Supabase REST); **at rest** on Postgres.
- [x] **Explicit consent** gate before any data leaves the device — the user must
      tick consent before sign‑in, and it guards every outbound push
      (`lib/cloud.js` `hasConsent()` → `pushRecord`/`pushAll`). The AI provider is
      already opt‑in (bring‑your‑own‑key, stored on‑device only, never synced).
- [x] **Secure file storage** — document/receipt/photo binaries sync to a
      **private** `attachments` bucket, namespaced by household so RLS
      (`is_member`) scopes each file to the family; reads go through the
      authenticated object endpoint with the user's token (no public URLs).
      Upload is best‑effort on save with a reconcile pass after each sync
      (`lib/files.js` `syncAttachments`), and files are lazily fetched + cached on
      first open on another device (`lib/cloud.js` `uploadFile`/`downloadFile`).
      All of it sits behind the same consent gate as record sync.
- [ ] **Audit log** table for important changes (create/update/delete of key
      entities).

## Family accounts (Phase 1 shipped)
- [x] **Roles** — the household creator is the `owner` (admin); invited people are
      `member` (`lib/cloud.js` tracks the role on the session). A member gets a
      restricted app shell (profile + assigned tasks only).
- [x] **Invites carry no secrets** — the WhatsApp invite link contains only the
      household code; the Supabase connection comes from build-time env, so the
      anon key never travels through chat. See `docs/FAMILY.md`.
- [x] **Member data minimisation (app-enforced)** — a member's device only
      requests their own profile record and the tasks assigned to them
      (`pullAll` scopes the queries; `pushRecord`/`pushAll` restrict members to
      the `people`/`tasks` collections). Finance, documents, garage, etc. never
      reach a member.
- [ ] **Member data minimisation (DB-enforced)** — Phase 2: row-level security so
      the same boundary holds even if a member calls the API directly, plus an
      admin UI to explicitly share chosen areas.

## Phase 3–4
- [ ] **Role‑based access** for family/assistant (least privilege, per‑module scopes).
- [ ] Per‑document access control; shareable links revocable.
- [ ] AI calls: send **only** the minimum context, redact where possible, log usage,
      allow per‑action opt‑out; never store prompts server‑side beyond the request.
- [ ] Account deletion cascades and purges storage.

## Secrets & config
- [ ] Never commit secrets. `.env` is git‑ignored; Supabase/AI keys live in host env
      vars (Vercel/GitHub Actions secrets), read via `import.meta.env`.
- [ ] Public anon key only on the client; service‑role keys **only** in server/Edge
      Functions.

## Practices
- [ ] Dependency updates & `npm audit` before releases.
- [ ] Content Security Policy on the hosted site.
- [ ] Input validation on every form (present in Phase 1 editors) + server‑side
      validation in Phase 2.
