import { buildReminderFields } from './reminders.js'

// The alert time for a task's "Remind me" choice, derived from its due date/time.
export function taskReminderISO(dueDate, dueTime, remind) {
  if (!dueDate || !remind || remind === 'none') return null
  const [h, m] = (dueTime || '09:00').split(':').map(Number)
  if (remind === 'morning') { const d = new Date(dueDate + 'T00:00:00'); d.setHours(9, 0, 0, 0); return d.toISOString() }
  const due = new Date(dueDate + 'T00:00:00'); due.setHours(h || 9, m || 0, 0, 0)
  if (remind === 'dayBefore') { due.setDate(due.getDate() - 1); return due.toISOString() }
  if (remind === 'hourBefore') { due.setHours(due.getHours() - 1); return due.toISOString() }
  return null
}

// Keep a task's due-date reminder in sync (its own record, flagged so it never
// clashes with a Work task's separate alert times). Call after anything that
// changes a task's title, due date/time or "Remind me" choice.
export function syncTaskReminder(reminders, task) {
  if (!task || !task.id) return
  const existing = reminders.items.find(r => r.taskId === task.id && r.dueReminder)
  const iso = taskReminderISO(task.dueDate, task.dueTime, task.remind)
  if (!iso) { if (existing) reminders.remove(existing.id); return }
  const fields = { ...buildReminderFields(task.title, [iso]), taskId: task.id, dueReminder: true, repeat: 'none', done: false }
  if (existing) reminders.save({ ...existing, ...fields }); else reminders.add(fields)
}
