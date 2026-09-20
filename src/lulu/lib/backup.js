// Automatic on-device backups. A rolling set of full snapshots (all records +
// settings) is kept in its OWN IndexedDB — separate from attachments, so it
// never bloats localStorage and is never mistaken for a cloud attachment. One
// snapshot is taken per day on open; the last few are retained for a one-tap
// restore if data is ever lost or a bad change needs undoing.
import { exportAll, importAll } from '../store/db.js'

const DB_NAME = 'lulu-backups'
const STORE = 'snapshots'
const KEEP = 5
const AT_KEY = 'lulu:v1:lastBackupAt'
let _db

function open() {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no idb')); return }
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return _db
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

export function lastBackupAt() {
  try { const v = localStorage.getItem(AT_KEY); return v ? Number(v) : 0 } catch { return 0 }
}
export function autoBackupDue() {
  return Date.now() - lastBackupAt() > 20 * 3600 * 1000 // ~once a day
}

export async function listSnapshots() {
  try { const keys = await tx('readonly', (s) => s.getAllKeys()); return (keys || []).map(Number).sort((a, b) => b - a) } catch { return [] }
}

async function prune() {
  const keys = await listSnapshots()
  for (const k of keys.slice(KEEP)) { await tx('readwrite', (s) => s.delete(k)) } // eslint-disable-line no-await-in-loop
}

// Take a snapshot now. Returns its timestamp, or 0 on failure.
export async function backupNow() {
  try {
    const at = Date.now()
    await tx('readwrite', (s) => s.put({ at, json: JSON.stringify(exportAll()) }, at))
    await prune()
    try { localStorage.setItem(AT_KEY, String(at)) } catch { /* ignore */ }
    return at
  } catch { return 0 }
}

// Take one automatically if a day has passed. No-op otherwise.
export async function runAutoBackupIfDue() {
  if (!autoBackupDue()) return 0
  return backupNow()
}

export async function getSnapshot(at) {
  try { const rec = await tx('readonly', (s) => s.get(Number(at))); return rec ? JSON.parse(rec.json) : null } catch { return null }
}

// Restore a snapshot (defaults to the most recent) into the app. Caller reloads.
export async function restoreSnapshot(at) {
  const keys = await listSnapshots()
  const target = at || keys[0]
  if (!target) return false
  const data = await getSnapshot(target)
  if (!data) return false
  importAll(data)
  return true
}
