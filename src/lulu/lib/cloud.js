// ============================================================================
// Cloud sync + family access via Supabase — talked to over its REST + Auth API
// with plain fetch (no SDK, keeps the PWA lean and offline-first).
//
// Model: one `records` table holds every synced record as JSONB, scoped to a
// `household`. Family members each have their own login and join a household by
// its code (the household UUID). Sync is pull-on-open + push-on-change +
// periodic pull — simple and robust, no websockets.
//
// Everything here is a no-op until the user configures a project URL + anon key
// AND signs in, so with cloud off the app is exactly as before (pure local).
// ============================================================================

import * as db from '../store/db.js'

const NS = 'lulu:v1:cloud'
const CFG_KEY = `${NS}:config`   // { url, anonKey }
const SES_KEY = `${NS}:session`  // { access_token, refresh_token, user, householdId }
const CONSENT_KEY = `${NS}:consent` // '1' once the user has agreed to sync leaving the device

function read(key, fb) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb } }
function write(key, v) { localStorage.setItem(key, JSON.stringify(v)) }

// ---- Config + session ----
// Connection comes from what the admin saved on this device, or — for family
// members who just install the app — from build-time env (VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY). The anon key is public by design, so baking it into
// the deployed app lets an invited member connect by tapping the link, with no
// setup and without the key ever travelling through the invite message.
function envConfig() {
  try {
    const e = import.meta.env || {}
    const url = (e.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
    const key = (e.VITE_SUPABASE_ANON_KEY || '').trim()
    return url && key ? { url, anonKey: key } : null
  } catch { return null }
}
export function getConfig() { return read(CFG_KEY, null) || envConfig() }
export function setConfig(url, anonKey) {
  const clean = (url || '').trim().replace(/\/+$/, '')
  if (!clean || !anonKey) { localStorage.removeItem(CFG_KEY); emit(); return }
  write(CFG_KEY, { url: clean, anonKey: anonKey.trim() })
  emit()
}
export function getSession() { return read(SES_KEY, null) }
function setSession(s) { if (s) write(SES_KEY, s); else localStorage.removeItem(SES_KEY); emit() }

export function isConfigured() { return !!getConfig() }
export function isSignedIn() { const s = getSession(); return !!(s && s.access_token && s.householdId) }
export function isReady() { return isConfigured() && isSignedIn() }

// Explicit privacy consent. The app is private/local by default; nothing is
// pushed to the cloud until the user has knowingly agreed. This gates every
// outbound write (pushRecord / pushAll), so ticking cloud config on without
// consent still uploads nothing.
export function hasConsent() { try { return localStorage.getItem(CONSENT_KEY) === '1' } catch { return false } }
// Migration: anyone already signed in before consent existed opted into cloud
// under the old flow — treat that as consent so their sync keeps working.
try { if (isSignedIn() && localStorage.getItem(CONSENT_KEY) == null) localStorage.setItem(CONSENT_KEY, '1') } catch { /* ignore */ }
export function setConsent(v) {
  try { if (v) localStorage.setItem(CONSENT_KEY, '1'); else localStorage.removeItem(CONSENT_KEY) } catch { /* ignore */ }
  emit()
}
export function currentUser() { const s = getSession(); return s && s.user }
export function householdId() { const s = getSession(); return s && s.householdId }

// ---- Roles (admin vs family member) ----
// The household creator is the 'owner' (admin); invited people are 'member'.
export function role() { const s = getSession(); return (s && s.role) || null }
export function isOwner() { return isSignedIn() && role() === 'owner' }
export function isMember() { return isSignedIn() && role() === 'member' }

// Collections a member's device is allowed to see/sync. Members get only their
// own profile (people) and their tasks; sensitive areas (finance, documents,
// garage…) never leave the admin's device in Phase 1.
export const MEMBER_COLLECTIONS = ['people', 'tasks']
function allowed(collection) { return !isMember() || MEMBER_COLLECTIONS.includes(collection) }

// The invite carries only the household code (a link the member taps). The
// project connection comes from build-time env, so no key is shared in chat.
export function inviteCode() { return householdId() }
export function inviteLink() {
  if (typeof window === 'undefined') return ''
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/join/${householdId() || ''}`
}

// ---- Status pub/sub (so the settings screen can reflect connection state) ----
const listeners = new Set()
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function emit() { listeners.forEach(fn => { try { fn() } catch { /* ignore */ } }) }

// ---- Low-level REST helpers ----
function base() { const c = getConfig(); return c && c.url }
function anon() { const c = getConfig(); return c && c.anonKey }

async function authFetch(path, opts = {}, retry = true) {
  const cfg = getConfig(); const ses = getSession()
  if (!cfg) throw new Error('Cloud not configured')
  const headers = {
    'apikey': cfg.anonKey,
    'content-type': 'application/json',
    ...(opts.headers || {}),
  }
  if (ses && ses.access_token) headers['Authorization'] = `Bearer ${ses.access_token}`
  const res = await fetch(`${cfg.url}${path}`, { ...opts, headers })
  if (res.status === 401 && retry && ses && ses.refresh_token) {
    const ok = await refresh()
    if (ok) return authFetch(path, opts, false)
  }
  return res
}

// ---- Auth ----
async function authRequest(kind, email, password) {
  const cfg = getConfig()
  if (!cfg) throw new Error('Add your Supabase URL and key first.')
  const path = kind === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password'
  const res = await fetch(`${cfg.url}${path}`, {
    method: 'POST',
    headers: { 'apikey': cfg.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || `Sign-in failed (${res.status}).`)
  if (!data.access_token) {
    // Sign-up with email confirmation on: no session yet.
    throw new Error('Check your email to confirm the account, then sign in.')
  }
  return data // { access_token, refresh_token, user, ... }
}

// `joinCode` (optional) makes this a family-member sign-in: instead of creating
// their own household, they join the admin's by its code.
export async function signIn(email, password, joinCode) {
  const data = await authRequest('signin', email, password)
  await establishSession(data, joinCode)
}
export async function signUp(email, password, joinCode) {
  const data = await authRequest('signup', email, password)
  await establishSession(data, joinCode)
}
export function signOut() { setSession(null) }

async function refresh() {
  const cfg = getConfig(); const ses = getSession()
  if (!cfg || !ses || !ses.refresh_token) return false
  try {
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': cfg.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: ses.refresh_token }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) { setSession(null); return false }
    setSession({ ...ses, access_token: data.access_token, refresh_token: data.refresh_token, user: data.user || ses.user })
    return true
  } catch { return false }
}

// After a fresh sign-in, persist the session then settle into a household:
// join the admin's by code (family member) or ensure the user's own (admin).
async function establishSession(data, joinCode) {
  setSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user, householdId: null, role: null })
  if (joinCode && String(joinCode).trim()) {
    await joinHousehold(joinCode)  // sets householdId + role 'member'
    return
  }
  const hid = await ensureHousehold(data.user)
  const r = await fetchRole(data.user.id, hid)
  const ses = getSession()
  setSession({ ...ses, householdId: hid, role: r })
}

// Read the signed-in user's role within a household ('owner' | 'member').
async function fetchRole(userId, hid) {
  try {
    const res = await authFetch(`/rest/v1/household_members?select=role&household_id=eq.${hid}&user_id=eq.${userId}`, { method: 'GET' })
    const rows = await res.json().catch(() => [])
    return (Array.isArray(rows) && rows[0] && rows[0].role) || 'member'
  } catch { return 'member' }
}

// ---- Households / family ----
// Find the user's household, or create one on first sign-in.
async function ensureHousehold(user) {
  const mine = await authFetch(`/rest/v1/household_members?select=household_id&user_id=eq.${user.id}`, { method: 'GET' })
  const rows = await mine.json().catch(() => [])
  if (Array.isArray(rows) && rows.length) return rows[0].household_id
  // Create a household + owner membership.
  const name = (user.email || 'My').split('@')[0]
  // Generate the id client-side and insert with return=minimal. This avoids
  // needing to read the new row back, which RLS blocks until the owner's
  // membership exists (created on the next call).
  const hid = uuid()
  const hRes = await authFetch('/rest/v1/households', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: hid, name: `${name}'s Household` }),
  })
  if (!hRes.ok) { const e = await hRes.json().catch(() => ({})); throw new Error(e.message || `Could not create a household (${hRes.status}). Check the setup SQL ran.`) }
  const mRes = await authFetch('/rest/v1/household_members', {
    method: 'POST',
    body: JSON.stringify({ household_id: hid, user_id: user.id, email: user.email, role: 'owner' }),
  })
  if (!mRes.ok) { const e = await mRes.json().catch(() => ({})); throw new Error(e.message || `Could not join the new household (${mRes.status}).`) }
  return hid
}

// RFC4122 v4 UUID — native when available, small fallback otherwise.
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Join an existing household by its code (the household UUID). Re-pull after.
export async function joinHousehold(code) {
  const ses = getSession()
  if (!ses) throw new Error('Sign in first.')
  const hid = (code || '').trim()
  const res = await authFetch('/rest/v1/household_members', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ household_id: hid, user_id: ses.user.id, email: ses.user.email, role: 'member' }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Could not join — check the code.') }
  setSession({ ...ses, householdId: hid, role: 'member' })
}

export async function listMembers() {
  if (!isReady()) return []
  const res = await authFetch(`/rest/v1/household_members?select=email,role,created_at&household_id=eq.${householdId()}`, { method: 'GET' })
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

// ---- Data sync ----
// Push one record (fire-and-forget from the store). Soft-deletes are just
// records whose data carries deletedAt, so this covers deletes too.
export async function pushRecord(collection, record) {
  if (!isReady() || !hasConsent() || !record || !record.id) return
  if (!allowed(collection)) return   // members only sync their scoped collections
  if (record.seed === true) return  // sample data stays local-only
  try {
    await authFetch('/rest/v1/records?on_conflict=household_id,id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        household_id: householdId(), id: record.id, collection,
        data: record, updated_at: record.updatedAt || new Date().toISOString(),
      }]),
    })
  } catch { /* offline / transient — next full sync reconciles */ }
}

// Push every local record (first sync after signing in on a device with data).
export async function pushAll() {
  if (!isReady() || !hasConsent()) return
  const all = db.allRecords().filter(({ collection, record }) => record.seed !== true && allowed(collection))
  for (let i = 0; i < all.length; i += 200) {
    const batch = all.slice(i, i + 200).map(({ collection, record }) => ({
      household_id: householdId(), id: record.id, collection,
      data: record, updated_at: record.updatedAt || new Date().toISOString(),
    }))
    await authFetch('/rest/v1/records?on_conflict=household_id,id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    }).catch(() => {})
  }
}

// Pull all remote records and merge into local. Returns the set of changed
// collections (so the store can reload just those), or null on failure.
export async function pullAll() {
  if (!isReady()) return null
  try {
    let rows
    const hid = householdId()
    const q = (path) => authFetch(`/rest/v1/records?select=collection,data&household_id=eq.${hid}${path}`, { method: 'GET' })
    if (isMember()) {
      // A member's device only ever fetches their OWN profile record and the
      // tasks assigned to them — the rest of the family's data (other people,
      // other tasks) is never even sent. (The Phase 2 RLS rules make this
      // enforced server-side; today the app simply never asks for more.)
      const uid = (currentUser() || {}).id
      const [pr, tr] = await Promise.all([
        q(`&collection=eq.people&data->>userId=eq.${uid}`),
        q(`&collection=eq.tasks&data->>assigneeUserId=eq.${uid}`),
      ])
      if (!pr.ok || !tr.ok) return null
      rows = [...(await pr.json().catch(() => [])), ...(await tr.json().catch(() => []))]
    } else {
      const res = await q('')
      if (!res.ok) return null
      rows = await res.json().catch(() => [])
    }
    const byCollection = {}
    for (const r of rows) {
      if (!r || !r.collection) continue
      ;(byCollection[r.collection] ||= []).push(r.data)
    }
    return db.mergeRemote(byCollection)
  } catch { return null }
}

// ---- Web-push subscriptions (background reminders) ----
// Store this device's push subscription in the household so the scheduled
// Edge Function can deliver reminders even when the app is closed.
export async function savePushSubscription(sub) {
  if (!isReady() || !sub || !sub.endpoint) return
  const ses = getSession()
  try {
    await authFetch('/rest/v1/push_subscriptions?on_conflict=household_id,endpoint', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ household_id: householdId(), user_id: ses.user.id, endpoint: sub.endpoint, subscription: sub }]),
    })
  } catch { /* offline / not set up — safe to ignore */ }
}
export async function deletePushSubscription(endpoint) {
  if (!isReady() || !endpoint) return
  try {
    await authFetch(`/rest/v1/push_subscriptions?household_id=eq.${householdId()}&endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' })
  } catch { /* ignore */ }
}

// Invoke a deployed Edge Function (e.g. send-reminders) with the signed-in
// user's token. Used by the in-app "test push" so we can exercise the whole
// background pipeline on demand. Returns the parsed JSON, or throws with a
// readable message. The function must send CORS headers to allow this.
export async function invokeFunction(name, body) {
  const cfg = getConfig(); const ses = getSession()
  if (!cfg) throw new Error('not-configured')
  if (!ses || !ses.access_token) throw new Error('not-connected')
  const res = await fetch(`${cfg.url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'apikey': cfg.anonKey, 'content-type': 'application/json', 'Authorization': `Bearer ${ses.access_token}` },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = { raw: text } }
  if (!res.ok) throw new Error(data.error || data.msg || `HTTP ${res.status}`)
  return data
}

// One full two-way sync: push local, then pull remote.
export async function syncNow() {
  if (!isReady()) return null
  await pushAll()
  return pullAll()
}

// ---- Attachment storage (document/receipt/photo binaries) ----
// Document records sync their metadata + thumbnail via `records`; the actual
// files live in the private `attachments` bucket, namespaced by household so RLS
// (is_member) scopes them to the family. Objects are keyed by the attachment id.
const BUCKET = 'attachments'
const UP_KEY = `${NS}:uploaded`  // { hid, ids: { [id]: 1 } } — what's already pushed

function attachPath(id) { return `${householdId()}/${encodeURIComponent(id)}` }

// Storage follows the same consent gate as record sync: no file leaves the
// device until the user has agreed.
export function storageReady() { return isReady() && hasConsent() }

// Local memo of which attachments are already in this household's bucket, so a
// reconcile pass doesn't re-upload every file each sync. Resets if the household
// changes (a different bucket namespace).
function uploadedState() {
  const s = read(UP_KEY, null)
  const hid = householdId()
  return (s && s.hid === hid && s.ids) ? s : { hid, ids: {} }
}
export function isUploaded(id) { return !!uploadedState().ids[id] }
export function markUploaded(id) { const s = uploadedState(); s.ids[id] = 1; write(UP_KEY, s) }

// Upload one blob (upsert — safe to repeat). Returns whether it persisted.
export async function uploadFile(id, blob) {
  if (!storageReady() || !id || !blob) return false
  try {
    const res = await authFetch(`/storage/v1/object/${BUCKET}/${attachPath(id)}`, {
      method: 'POST',
      headers: { 'content-type': blob.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: blob,
    })
    return res.ok
  } catch { return false }
}

// Fetch one blob back from the bucket (private → authenticated endpoint + token).
export async function downloadFile(id) {
  if (!storageReady() || !id) return null
  try {
    const res = await authFetch(`/storage/v1/object/authenticated/${BUCKET}/${attachPath(id)}`, { method: 'GET' })
    if (!res.ok) return null
    return await res.blob()
  } catch { return null }
}

// Best-effort remote delete when an attachment is removed locally.
export async function deleteFileRemote(id) {
  if (!storageReady() || !id) return
  try { await authFetch(`/storage/v1/object/${BUCKET}/${attachPath(id)}`, { method: 'DELETE' }) } catch { /* ignore */ }
}
