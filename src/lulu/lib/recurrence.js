import { isoDate, todayISO } from './format.js'

export const RECURRENCE = [
  { id: 'none', key: 'rec_none' },
  { id: 'daily', key: 'rec_daily' },
  { id: 'weekly', key: 'rec_weekly' },
  { id: 'monthly', key: 'rec_monthly' },
  { id: 'yearly', key: 'rec_yearly' },
]

// The next due date after `dateStr` for a given frequency (null if non-recurring).
export function nextDate(dateStr, freq) {
  const base = dateStr ? new Date(isoDate(dateStr)) : new Date(todayISO())
  const d = new Date(base)
  switch (freq) {
    case 'daily': d.setDate(d.getDate() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    default: return null
  }
  return d.toISOString().slice(0, 10)
}

export function isRecurring(task) {
  return task && task.recurrence && task.recurrence !== 'none'
}

// Toggle a task's completion. When completing a recurring task, spawn the next
// occurrence (fresh, not completed) so the series continues automatically.
// Returns true if a new occurrence was created.
export function completeTask(task, tasksApi) {
  const done = task.status === 'completed'
  tasksApi.patch(task.id, {
    status: done ? 'new' : 'completed',
    completedAt: done ? null : new Date().toISOString(),
  })
  if (!done && isRecurring(task)) {
    const nd = nextDate(task.dueDate, task.recurrence)
    if (nd) {
      const { id, createdAt, updatedAt, completedAt, ...rest } = task
      tasksApi.add({ ...rest, status: 'planned', dueDate: nd, completedAt: null })
      return true
    }
  }
  return false
}
