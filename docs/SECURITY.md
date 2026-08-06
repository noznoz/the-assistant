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
- [ ] **Secure file storage** with signed, expiring URLs for documents/receipts.
      *(An `attachments` bucket + member‑scoped policies are provisioned in
      `supabase/schema.sql`; the client upload/download path is still to be wired —
      today attachment binaries stay on the originating device.)*
- [ ] **Audit log** table for important changes (create/update/delete of key
      entities).

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
