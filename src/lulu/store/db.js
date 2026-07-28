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
  'expenses', 'projects', 'subscriptions', 'rewards',
  'people', 'documents', 'trips', 'notes', 'notifications',
]

function keyFor(name) { return `${NS}:${name}` }

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
  localStorage.setItem(keyFor(name), JSON.stringify(rows))
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
  update(name, id, { deletedAt: nowISO() })
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
  monthlyBudget: 0,
  customCategories: [],  // user-added expense categories (labels)
  categoryBudgets: {},   // { [categoryId]: monthly amount }
  rates: {},             // { [currency]: SAR per unit } — overrides DEFAULT_RATES
  profile: {},           // owner's personal info + Saudi National Address
}

export function readSettings() {
  return { ...DEFAULT_SETTINGS, ...safeParse(localStorage.getItem(keyFor('settings')), {}) }
}
export function writeSettings(s) {
  localStorage.setItem(keyFor('settings'), JSON.stringify(s))
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
