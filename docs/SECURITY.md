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
- [ ] Supabase **Auth**: email magic‑link + **Apple Sign‑In**.
- [ ] **Row Level Security** on every table (`owner_id = auth.uid()`) — a user can
      only ever read/write their own rows. (DDL in `DATABASE.md`.)
- [ ] **Face ID / Touch ID / passcode** app lock + **auto‑lock** on background.
- [ ] **Encrypted at rest** (Supabase/Postgres) and **in transit** (TLS).
- [ ] **Secure file storage** with signed, expiring URLs for documents/receipts.
- [ ] **Explicit consent** screen before any cloud sync or AI provider is enabled.
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
