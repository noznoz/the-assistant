// The customizable cards on the Today (home) screen. Order + visibility live in
// settings.dashboard as an array of { key, on }. Attention lists (overdue, due
// today, waiting) are core and always shown after these.
export const DASHBOARD_SECTIONS = [
  { key: 'brief', label: 'dashBrief' },
  { key: 'assistant', label: 'dashAssistant' },
  { key: 'prayer', label: 'dashPrayer' },
  { key: 'stats', label: 'dashStats' },
  { key: 'quickActions', label: 'dashQuick' },
  { key: 'work', label: 'dashWork' },
  { key: 'renewals', label: 'dashRenewals' },
  { key: 'notes', label: 'dashNotes' },
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
  DEFAULT_KEYS.forEach(k => { if (!seen.has(k)) out.push({ key: k, on: true }) })
  return out
}

export function labelForSection(key) {
  const s = DASHBOARD_SECTIONS.find(x => x.key === key)
  return s ? s.label : key
}
