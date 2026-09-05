// Personal reminders: the user writes anything + up to 3 alert times, and the
// app fires an on-device notification as each time comes due. This works while
// the app is open or freshly reopened; delivery while the app is fully closed
// needs background web push (the send-reminders Edge Function).
//
// Model: a reminder carries `times` (1–3 ISO strings, ascending) and
// `firedCount` (how many of the earliest times have already alerted). `done`
// marks it finished. For backward compatibility we still read/write the legacy
// single-time fields `remindAt` (mirrors the next pending time) and `notified`
// (true once every time has fired), so older records and the old Edge Function
// keep working.
import { showNotification, notificationsSupported } from './notify.js'

export const MAX_TIMES = 3

// Repeat options for a recurring reminder.
export const REMINDER_REPEATS = ['none', 'daily', 'weekly', 'monthly']

// The next occurrence's alert times for a repeating reminder: advance every time
// by one period, repeatedly, until the latest is in the future (so a reminder
// that lapsed while the app was closed lands on the next real occurrence, not a
// burst of catch-ups). Returns null when it isn't repeating.
export function nextRepeatTimes(times, repeat, now = Date.now()) {
  if (!repeat || repeat === 'none' || !times.length) return null
  const ds = times.map(t => new Date(t)).filter(d => !isNaN(d))
  if (!ds.length) return null
  const step = () => ds.forEach(d => {
    if (repeat === 'monthly') d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + (repeat === 'weekly' ? 7 : 1))
  })
  let guard = 0
  do { step(); guard++ } while (Math.max(...ds.map(d => d.getTime())) <= now && guard < 400)
  return ds.map(d => d.toISOString())
}

// Reschedule a reminder to a single future time (used by "snooze").
export function snoozeFields(text, whenIso) {
  return buildReminderFields(text, [whenIso])
}

// Normalized, de-duplicated, ascending list of a reminder's alert times.
export function reminderTimes(r) {
  const raw = Array.isArray(r?.times) && r.times.length ? r.times : (r?.remindAt ? [r.remindAt] : [])
  return [...new Set(raw.filter(Boolean))].sort()
}

// How many of the earliest times have already alerted (fired in order).
export function firedCountOf(r) {
  if (typeof r?.firedCount === 'number') return r.firedCount
  return r?.notified ? reminderTimes(r).length : 0
}

// The next time that hasn't fired yet (may be in the past if not yet checked), or null.
export function nextPendingTime(r) {
  const times = reminderTimes(r)
  return times[firedCountOf(r)] || null
}

export function lastTime(r) {
  const times = reminderTimes(r)
  return times[times.length - 1] || null
}

// How many pending (not-yet-alerted) times remain.
export function pendingCount(r) {
  return Math.max(0, reminderTimes(r).length - firedCountOf(r))
}

// The mirror fields to store alongside times/firedCount so legacy readers and
// the notification feed keep pointing at the next pending time.
function mirror(times, firedCount) {
  return {
    remindAt: times[Math.min(firedCount, times.length - 1)] || null,
    notified: firedCount >= times.length,
  }
}

// Build the stored fields from a text + a set of chosen ISO times. Times already
// in the past are counted as fired, so editing never re-alerts a passed time.
export function buildReminderFields(text, isoTimes) {
  const times = [...new Set((isoTimes || []).filter(Boolean))].sort()
  const now = Date.now()
  const firedCount = times.filter(t => new Date(t).getTime() <= now).length
  return { text, times, firedCount, ...mirror(times, firedCount) }
}

// Reminders with at least one due, not-yet-alerted time (and not done).
export function dueReminders(items = []) {
  const now = Date.now()
  return (items || []).filter(r => {
    if (!r || r.done) return false
    const passed = reminderTimes(r).filter(t => new Date(t).getTime() <= now).length
    return passed > firedCountOf(r)
  })
}

// Fire any newly-due reminders (one catch-up notification each) and advance
// their fired count. No-op without notification permission.
export async function fireDueReminders(items, { patch, heading = 'Reminder' } = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return 0
  const now = Date.now()
  const due = dueReminders(items)
  const nowIso = new Date().toISOString()
  for (const r of due) {
    const times = reminderTimes(r)
    const passed = times.filter(t => new Date(t).getTime() <= now).length
    // eslint-disable-next-line no-await-in-loop
    await showNotification(heading, r.text || '', 'reminder-' + r.id)
    if (!patch) continue
    // Fully fired + repeating → roll forward to the next occurrence.
    if (passed >= times.length && r.repeat && r.repeat !== 'none') {
      const nt = nextRepeatTimes(times, r.repeat, now)
      if (nt) { patch(r.id, { times: nt, firedCount: 0, ...mirror(nt, 0), firedAt: nowIso }); continue }
    }
    patch(r.id, { firedCount: passed, ...mirror(times, passed), firedAt: nowIso })
  }
  return due.length
}

// Split a list into upcoming (next pending time is in the future) and past
// (fired/overdue/done), each sorted. Ordering matches the display sections.
export function splitReminders(items = []) {
  const now = Date.now()
  const alive = (items || []).filter(r => reminderTimes(r).length)
  const upcoming = alive
    .filter(r => { const n = nextPendingTime(r); return !r.done && n && new Date(n).getTime() > now })
    .sort((a, b) => new Date(nextPendingTime(a)) - new Date(nextPendingTime(b)))
  const past = alive
    .filter(r => { const n = nextPendingTime(r); return r.done || !n || new Date(n).getTime() <= now })
    .sort((a, b) => new Date(lastTime(b)) - new Date(lastTime(a)))
  return { upcoming, past }
}
