// ============================================================================
// Lulu local database — offline-first persistence layer.
//
// Every collection is an array of records: { id, ...fields, createdAt, updatedAt,
// deletedAt (soft delete) }. Data lives in localStorage under a namespaced key.
// The API mirrors what a Supabase-backed store would expose, so a sync adapter
// can later replace the storage backend without changing any UI code.
// ============================================================================

const NS = 'lulu:v1'

export const COLLECTIONS = [
  'tasks', 'inbox', 'vehicles', 'services', 'accessories',
  'expenses', 'income', 'investments', 'accounts', 'networth', 'liabilities',
  'properties', 'valuables', 'memberships', 'projects', 'subscriptions', 'rewards',
  'people', 'groups', 'documents', 'trips', 'notes', 'notifications', 'wishlist', 'goals', 'appointments',
  'staff', 'propertylog', 'itinerary', 'departments', 'members', 'meetings', 'spiritual', 'giving',
  'vaults', 'reminders',
]

function keyFor(name) { return `${NS}:${name}` }

// A localStorage write that survives a full quota. When the browser refuses the
// write (QuotaExceededError — common once photos/receipts pile up), we don't let
// the exception tear through a save: we surface it as a `lulu:storage-full`
// window event (the app shows a banner) and swallow it, so the in-memory state
// the user just changed stays intact until they free space. Returns whether the
// write actually persisted.
function persist(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)
    try {
      window.dispatchEvent(new CustomEvent('lulu:storage-full', { detail: { key, quota: !!quota } }))
    } catch { /* non-browser / SSR */ }
    return false
  }
}

export function uid() {
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function nowISO() { return new Date().toISOString() }

function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}

export function readCollection(name) {
  const rows = safeParse(localStorage.getItem(keyFor(name)), [])
  return rows.filter(r => !r.deletedAt)
}

export function writeCollection(name, rows) {
  return persist(keyFor(name), JSON.stringify(rows))
}

// Reads including soft-deleted rows (needed for correct upserts).
function readRaw(name) {
  return safeParse(localStorage.getItem(keyFor(name)), [])
}

export function insert(name, fields) {
  const rows = readRaw(name)
  const rec = { id: uid(), ...fields, createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null }
  rows.unshift(rec)
  writeCollection(name, rows)
  return rec
}

export function update(name, id, patch) {
  const rows = readRaw(name)
  let next = null
  const out = rows.map(r => {
    if (r.id !== id) return r
    next = { ...r, ...patch, updatedAt: nowISO() }
    return next
  })
  writeCollection(name, out)
  return next
}

export function upsert(name, rec) {
  if (rec.id && readRaw(name).some(r => r.id === rec.id)) {
    const { id, ...patch } = rec
    return update(name, id, patch)
  }
  return insert(name, rec)
}

export function softDelete(name, id) {
  return update(name, id, { deletedAt: nowISO() })
}

// ---- Cloud sync helpers ----
// Raw upsert used by cloud sync: writes the record verbatim (preserving its id,
// timestamps and deletedAt) instead of generating new ones like insert() does.
export function putRaw(name, rec) {
  if (!rec || !rec.id) return
  const rows = readRaw(name)
  const i = rows.findIndex(r => r.id === rec.id)
  if (i >= 0) rows[i] = rec
  else rows.unshift(rec)
  writeCollection(name, rows)
}

// Merge a batch of remote records into local storage, last-write-wins by
// updatedAt. `byCollection` is { collectionName: [record, …] }. Returns the set
// of collection names that actually changed, so callers can reload just those.
export function mergeRemote(byCollection) {
  const changed = new Set()
  Object.entries(byCollection || {}).forEach(([name, recs]) => {
    if (!COLLECTIONS.includes(name) || !Array.isArray(recs)) return
    const rows = readRaw(name)
    const idx = new Map(rows.map(r => [r.id, r]))
    let dirty = false
    recs.forEach(rec => {
      if (!rec || !rec.id) return
      const cur = idx.get(rec.id)
      if (!cur || (rec.updatedAt || '') > (cur.updatedAt || '')) { idx.set(rec.id, rec); dirty = true }
    })
    if (dirty) { writeCollection(name, [...idx.values()]); changed.add(name) }
  })
  return changed
}

// Every local record across all collections, tagged with its collection — used
// for the first full push to the cloud after signing in.
export function allRecords() {
  const out = []
  COLLECTIONS.forEach(c => readRaw(c).forEach(r => out.push({ collection: c, record: r })))
  return out
}

// ---- Settings (single object, not a collection) ----
export const DEFAULT_SETTINGS = {
  name: '',
  language: 'en',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  dateFormat: 'DD MMM YYYY',
  theme: 'system',       // system | light | dark
  requireLock: false,    // app lock master toggle (with pinHash set)
  pinHash: '',           // SHA-256 of the passcode
  biometricId: '',       // WebAuthn credential id (base64) for Face ID unlock
  notifications: false,  // on-device notifications + badge
  aiProvider: 'none',    // none | claude | openai
  anthropicKey: '',      // Anthropic API key for the in-app assistant (on-device only)
  aiModel: 'claude-sonnet-5', // model id used by the assistant
  monthlyBudget: 0,
  customCategories: [],  // user-added expense categories (labels)
  categoryBudgets: {},   // { [categoryId]: monthly amount }
  rates: {},             // { [currency]: SAR per unit } — overrides DEFAULT_RATES
  profile: {},           // owner's personal info + Saudi National Address
  notificationsSeen: [], // ids of notification-feed items already viewed
  accounts: ['Salary account', 'Other account'], // funding accounts an expense can be paid from
  dashboard: null,       // Today-screen card order/visibility (null = default)
  targetAllocation: {},  // desired investment mix by type { [typeId]: percent }
  favorites: [],         // pinned section ids shown at the top of More
  navTabs: null,         // user-chosen middle bottom-bar tabs (null = default)
}

export function readSettings() {
  return { ...DEFAULT_SETTINGS, ...safeParse(localStorage.getItem(keyFor('settings')), {}) }
}
export function writeSettings(s) {
  return persist(keyFor('settings'), JSON.stringify(s))
}

// ---- Full export / import (backup) ----
export function exportAll() {
  const data = { __lulu: NS, exportedAt: nowISO(), settings: readSettings(), collections: {} }
  COLLECTIONS.forEach(c => { data.collections[c] = readRaw(c) })
  return data
}

export function importAll(data) {
  if (!data || !data.collections) throw new Error('Invalid Lulu backup file')
  if (data.settings) writeSettings({ ...DEFAULT_SETTINGS, ...data.settings })
  COLLECTIONS.forEach(c => {
    if (Array.isArray(data.collections[c])) writeCollection(c, data.collections[c])
  })
}

export function wipeAll() {
  COLLECTIONS.forEach(c => localStorage.removeItem(keyFor(c)))
  localStorage.removeItem(keyFor('settings'))
  localStorage.removeItem(keyFor('seeded'))
}

export function markSeeded() { localStorage.setItem(keyFor('seeded'), '1') }
export function isSeeded() { return localStorage.getItem(keyFor('seeded')) === '1' }

// One-time migration: turn the old string list of accounts (settings.accounts)
// into proper account records with balances. Runs whenever the accounts
// collection is empty, so existing users get their accounts carried over.
export function ensureAccounts() {
  if (readCollection('accounts').length > 0) return
  const names = (readSettings().accounts && readSettings().accounts.length)
    ? readSettings().accounts : ['Salary account', 'Other account']
  names.forEach((name, i) => insert('accounts', {
    name, type: i === 0 ? 'salary' : 'current',
    openingBalance: 0, includeInNet: true, isDefault: i === 0,
  }))
}
