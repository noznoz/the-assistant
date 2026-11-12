import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { completeTask } from '../../lib/recurrence.js'
import { pointsFor, awardPoints } from '../../lib/points.js'
import { syncTaskReminder } from '../../lib/taskReminder.js'
import { todayISO } from '../../lib/format.js'
import { share, formatFollowUp, formatNudge, whatsappToPerson, personDigits } from '../../lib/share.js'

const pad = (n) => String(n).padStart(2, '0')
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// "Later today" = about three hours from now, on the hour; not offered late
// in the evening, when there is no "later today" left.
export function laterTodayTime(now = new Date()) {
  const h = now.getHours() + 3
  return h <= 21 ? `${pad(h)}:00` : null
}

// The things you can do to a task from anywhere (Plan, Today, Tasks): mark it
// done, snooze it, follow up on it, tick a checklist item. Each change shows a
// toast with Undo that puts everything back.
export function useTaskActions(toast) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const people = useCollection('people')
  const reminders = useCollection('reminders')

  const assigneeOf = (task) => people.items.find(p => p.id === task.assigneeId) || people.items.find(p => p.name === task.assignedTo)

  const complete = (task) => {
    const done = task.status === 'completed'
    const spawned = completeTask(task, tasks)
    const assignee = assigneeOf(task)
    if (assignee) awardPoints(assignee, done ? -pointsFor(task) : pointsFor(task), people)
    if (done) return
    // Undo restores the status, removes the next repeat it created (if any),
    // and puts the assignee's points back.
    const undo = () => {
      tasks.patch(task.id, { status: task.status, completedAt: task.completedAt || null })
      if (spawned && spawned.id) tasks.remove(spawned.id)
      if (assignee) people.patch(assignee.id, { points: Number(assignee.points) || 0 })
    }
    toast.show(spawned ? t('repeatsToast') : '✓ ' + t('completed'), [{ label: t('undo'), onClick: undo }])
  }

  // when: 'later' (today, ~3h from now) | 'tomorrow' | 'week' (7 days on)
  const snooze = (task, when) => {
    const today = todayISO()
    const next = when === 'later' ? { dueDate: today, dueTime: laterTodayTime() || task.dueTime || '' }
      : { dueDate: addDays(today, when === 'week' ? 7 : 1), dueTime: task.dueTime || '' }
    tasks.patch(task.id, next)
    syncTaskReminder(reminders, { ...task, ...next })
    const undo = () => {
      const prev = { dueDate: task.dueDate || '', dueTime: task.dueTime || '' }
      tasks.patch(task.id, prev)
      syncTaskReminder(reminders, { ...task, ...prev })
    }
    const label = when === 'later' ? t('laterToday') : when === 'week' ? t('nextWeek') : t('tomorrow')
    toast.show(`${t('movedTo')} ${label}`, [{ label: t('undo'), onClick: undo }])
  }

  // WhatsApp the assignee directly when we have their number; otherwise open
  // the share sheet with a ready follow-up message.
  const followUp = (task) => {
    const assignee = assigneeOf(task)
    if (assignee && personDigits(assignee)) whatsappToPerson(assignee, formatNudge(task, assignee, lang, settings))
    else share(formatFollowUp(task, lang, settings))
  }

  const toggleSub = (task, subId) => {
    tasks.patch(task.id, { subtasks: (task.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s) })
  }

  return { complete, snooze, followUp, toggleSub }
}
