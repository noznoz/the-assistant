// Simple personal reminders: the user writes anything + a time, and the app
// fires an on-device notification when it's due. This works while the app is
// open or freshly reopened; true delivery while the app is fully closed needs
// background web push (a separate, server-backed step).
import { showNotification, notificationsSupported } from './notify.js'

// Reminders that are due now (remindAt in the past) and haven't fired/finished.
export function dueReminders(items = []) {
  const now = Date.now()
  return (items || []).filter(r =>
    r && !r.done && !r.notified && r.remindAt && new Date(r.remindAt).getTime() <= now)
}

// Fire any due reminders and mark them notified (once). No-op without permission.
export async function fireDueReminders(items, { patch, heading = 'Reminder' } = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return 0
  const due = dueReminders(items)
  for (const r of due) {
    // eslint-disable-next-line no-await-in-loop
    await showNotification(heading, r.text || '', 'reminder-' + r.id)
    patch && patch(r.id, { notified: true, notifiedAt: new Date().toISOString() })
  }
  return due.length
}

// Split a list into upcoming (future) and past (fired/overdue/done), each sorted.
export function splitReminders(items = []) {
  const now = Date.now()
  const alive = (items || []).filter(r => r && r.remindAt)
  const upcoming = alive.filter(r => !r.done && new Date(r.remindAt).getTime() > now)
    .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt))
  const past = alive.filter(r => r.done || new Date(r.remindAt).getTime() <= now)
    .sort((a, b) => new Date(b.remindAt) - new Date(a.remindAt))
  return { upcoming, past }
}
