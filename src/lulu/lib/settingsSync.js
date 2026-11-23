// Which settings follow you across devices, and how two copies are merged.
//
// Personal data (profile and photo, budgets, categories, rates…) syncs; per-
// device preferences (language, theme, text size, lock, notifications, layout)
// stay on each device. Each signed-in person has their own record, so family
// members in the same household never overwrite each other's profile.
//
// Merging:
//  • A device that has never synced settings only FILLS EMPTY fields from the
//    cloud (field by field inside the profile), then uploads the result. So a
//    fresh device can never wipe a filled-in profile, whichever syncs first.
//  • After that, the newer copy wins (settingsUpdatedAt).
export const SYNCED_SETTINGS = [
  'name', 'currency', 'timezone', 'profile', 'monthlyBudget', 'categoryBudgets',
  'customCategories', 'customDocCategories', 'rates', 'targetAllocation',
]

export const isEmptyVal = (v) => v == null || v === '' || v === 0 ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

export function pickSynced(s) {
  const out = {}
  SYNCED_SETTINGS.forEach(k => { if (s && s[k] !== undefined) out[k] = s[k] })
  return out
}

const nonEmptyEntries = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => !isEmptyVal(v)))

// local: this device's full settings. remote: { values, updatedAt } | null.
// Returns { patch, stamp, push }: settings to apply here (or null), the
// settingsUpdatedAt to record, and whether to upload afterwards.
export function mergeSettings(local, remote, now = new Date().toISOString()) {
  const values = remote && remote.values ? remote.values : null
  if (!local.settingsSyncedOnce) {
    if (!values) return { patch: { settingsSyncedOnce: true, settingsUpdatedAt: now }, stamp: now, push: true }
    const patch = { settingsSyncedOnce: true, settingsUpdatedAt: now }
    SYNCED_SETTINGS.forEach(k => {
      const lv = local[k], rv = values[k]
      if (k === 'profile' || k === 'categoryBudgets' || k === 'rates' || k === 'targetAllocation') {
        if (rv && typeof rv === 'object') patch[k] = { ...rv, ...nonEmptyEntries(lv) }
      } else if (isEmptyVal(lv) && !isEmptyVal(rv)) patch[k] = rv
    })
    return { patch, stamp: now, push: true }
  }
  const lt = local.settingsUpdatedAt || '', rt = (remote && remote.updatedAt) || ''
  if (!values || rt < lt) return { patch: null, stamp: lt, push: !!lt }
  if (rt > lt) return { patch: { ...values, settingsUpdatedAt: rt }, stamp: rt, push: false }
  return { patch: null, stamp: lt, push: false }
}
