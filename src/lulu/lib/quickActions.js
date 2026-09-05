// The buttons in the Today screen's "Quick actions" grid. Which ones appear
// (and their order) live in settings.quickActions as an array of { id, on }.
// Each action maps to an editor or a screen (handled in TodayScreen).
export const QUICK_ACTIONS = [
  { id: 'snap', key: 'snapFile', icon: 'camera' },
  { id: 'task', key: 'addTask', icon: 'check' },
  { id: 'reminder', key: 'addReminder', icon: 'bell' },
  { id: 'request', key: 'addRequest', icon: 'inbox' },
  { id: 'expense', key: 'addExpense', icon: 'wallet' },
  { id: 'note', key: 'addNote', icon: 'note' },
  { id: 'message', key: 'sendMessage', icon: 'whatsapp' },
  { id: 'appointment', key: 'addAppointment', icon: 'calendar' },
  { id: 'vehicle', key: 'addVehicle', icon: 'car' },
  { id: 'receipt', key: 'scanReceipt', icon: 'receipt' },
]

const DEFAULT_IDS = QUICK_ACTIONS.map(a => a.id)

// Merge a saved config with the canonical list: keep the saved order and on
// flags, drop unknown ids, and append any newly-added actions (default on).
export function normalizeQuickActions(saved) {
  const known = new Set(DEFAULT_IDS)
  const out = []
  const seen = new Set()
  ;(Array.isArray(saved) ? saved : []).forEach(item => {
    if (item && known.has(item.id) && !seen.has(item.id)) {
      out.push({ id: item.id, on: item.on !== false })
      seen.add(item.id)
    }
  })
  DEFAULT_IDS.forEach(id => { if (!seen.has(id)) out.push({ id, on: true }) })
  return out
}

export function quickActionDef(id) {
  return QUICK_ACTIONS.find(a => a.id === id) || null
}
