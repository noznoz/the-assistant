// The customizable cards on the Today (home) screen. Order + visibility live in
// settings.dashboard as an array of { key, on }. Attention lists (overdue, due
// today, waiting) are core and always shown after these.
// `defaultOn` decides what a brand-new / never-customized home shows. We keep
// the front page calm by default — essentials on, the rest one tap away (they
// stay reachable from their own screens and can be switched back on in
// Customize home). Anyone who has saved their own layout keeps it untouched.
export const DASHBOARD_SECTIONS = [
  { key: 'brief', label: 'dashBrief', defaultOn: true },
  { key: 'assistant', label: 'dashAssistant', defaultOn: true },
  { key: 'reminders', label: 'dashReminders', defaultOn: false },
  { key: 'prayer', label: 'dashPrayer', defaultOn: true },
  { key: 'stats', label: 'dashStats', defaultOn: false },
  { key: 'quickActions', label: 'dashQuick', defaultOn: true },
  { key: 'work', label: 'dashWork', defaultOn: false },
  { key: 'renewals', label: 'dashRenewals', defaultOn: false },
  { key: 'notes', label: 'dashNotes', defaultOn: false },
]

const DEFAULT_KEYS = DASHBOARD_SECTIONS.map(s => s.key)

// Merge a saved config with the canonical list: keep the saved order and on
// flags, drop unknown keys, and append any newly-added sections (default on).
export function normalizeDashboard(saved) {
  const known = new Set(DEFAULT_KEYS)
  const out = []
  const seen = new Set()
  ;(Array.isArray(saved) ? saved : []).forEach(item => {
    if (item && known.has(item.key) && !seen.has(item.key)) {
      out.push({ key: item.key, on: item.on !== false })
      seen.add(item.key)
    }
  })
  DASHBOARD_SECTIONS.forEach(s => { if (!seen.has(s.key)) out.push({ key: s.key, on: s.defaultOn !== false }) })
  return out
}

export function labelForSection(key) {
  const s = DASHBOARD_SECTIONS.find(x => x.key === key)
  return s ? s.label : key
}
