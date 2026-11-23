// Which settings follow you across devices, and how two copies are merged.
//
// Personal data (profile and photo, budgets, categories, rates…) syncs; per-
// device preferences (language, theme, text size, lock, notifications, layout)
// stay on each device. Each signed-in person has their own record, so family
// members in the same household never overwrite each other's profile.
//
// Merging is FIELD BY FIELD: every synced value — and every field inside the
// profile, budgets, rates and allocation — carries its own "last changed"
// time (settingsStamps). For each field the newer change wins, so changing
// the currency on one device can never wipe the photo set on another.
// Values from before stamps existed count as older than any real change, but
// win over a field the other side never set.
export const SYNCED_SETTINGS = [
  'name', 'currency', 'timezone', 'profile', 'monthlyBudget', 'categoryBudgets',
  'customCategories', 'customDocCategories', 'rates', 'targetAllocation',
]
const OBJ = new Set(['profile', 'categoryBudgets', 'rates', 'targetAllocation'])
const OLD = '0' // stamp for a value that predates stamps: older than any real change

export const isEmptyVal = (v) => v == null || v === '' || v === 0 ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function pickSynced(s) {
  const out = {}
  SYNCED_SETTINGS.forEach(k => { if (s && s[k] !== undefined) out[k] = s[k] })
  return out
}

// Settings → flat fields: 'currency', 'profile.photo', 'rates.USD', …
export function entries(s) {
  const out = {}
  SYNCED_SETTINGS.forEach(k => {
    const v = s ? s[k] : undefined
    if (OBJ.has(k)) Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v : {}).forEach(([sk, sv]) => { out[`${k}.${sk}`] = sv })
    else if (v !== undefined) out[k] = v
  })
  return out
}
// Flat fields → settings (object settings always present, possibly {}).
function build(flat) {
  const out = {}
  OBJ.forEach(k => { out[k] = {} })
  Object.entries(flat).forEach(([e, v]) => {
    if (v === undefined) return
    const i = e.indexOf('.')
    const k = i > 0 && OBJ.has(e.slice(0, i)) ? e.slice(0, i) : null
    if (k) out[k][e.slice(i + 1)] = v
    else out[e] = v
  })
  return out
}

// Fields that differ between two settings objects (for stamping local edits).
export function changedEntries(before, after) {
  const a = entries(before), b = entries(after)
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(e => !same(a[e], b[e]))
}

// This device's effective stamps: recorded ones, plus OLD (or the older
// whole-copy time) for set values that predate per-field stamps.
export function stampsOf(local) {
  const st = { ...((local && local.settingsStamps) || {}) }
  const legacy = (local && local.settingsUpdatedAt) || OLD
  Object.entries(entries(local)).forEach(([e, v]) => { if (!st[e] && !isEmptyVal(v)) st[e] = legacy })
  return st
}
function remoteStamps(remote) {
  if (remote.stamps) return remote.stamps
  const st = {}, t = remote.updatedAt || OLD // copy from before per-field stamps
  Object.entries(entries(remote.values || {})).forEach(([e, v]) => { if (!isEmptyVal(v)) st[e] = t })
  return st
}
const maxStamp = (st) => Object.values(st).reduce((m, x) => (x > m ? x : m), '')

// local: this device's full settings. remote: { values, stamps?, updatedAt } | null.
// Returns { patch, push }: settings to apply here (or null) and whether to upload.
export function mergeSettings(local, remote) {
  const le = entries(local), ls = stampsOf(local)
  const firstTime = !local.settingsSyncedOnce
  if (!remote || !remote.values) {
    return { patch: { settingsSyncedOnce: true, settingsStamps: ls, settingsUpdatedAt: maxStamp(ls) || local.settingsUpdatedAt || '' }, push: Object.keys(le).length > 0 }
  }
  const re = entries(remote.values), rs = remoteStamps(remote)
  const merged = { ...le }, stamps = { ...ls }
  let changedHere = false, push = false
  for (const e of new Set([...Object.keys(le), ...Object.keys(re), ...Object.keys(ls), ...Object.keys(rs)])) {
    const a = ls[e] || '', b = rs[e] || ''
    if (b > a) {
      if (!same(le[e], re[e])) { merged[e] = re[e]; changedHere = true }
      stamps[e] = b
    } else if (a > b) {
      if (!same(le[e], re[e])) push = true
    } else if (!same(le[e], re[e])) {
      // Neither side ever changed it on purpose: keep whichever has a value.
      if (isEmptyVal(le[e]) && !isEmptyVal(re[e])) { merged[e] = re[e]; changedHere = true }
      else push = true
    }
  }
  const bookkeeping = firstTime || !same(stamps, local.settingsStamps || {})
  if (!changedHere && !bookkeeping) return { patch: null, push }
  const patch = { settingsSyncedOnce: true, settingsStamps: stamps, settingsUpdatedAt: maxStamp(stamps) }
  if (changedHere) Object.assign(patch, build(merged))
  return { patch, push: push || (firstTime && Object.keys(le).length > 0 && !same(le, re)) }
}

// What gets uploaded.
export function payload(settings) {
  const stamps = stampsOf(settings)
  return { values: pickSynced(settings), stamps, updatedAt: maxStamp(stamps) }
}
