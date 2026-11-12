import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Chip, Section, Empty, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { findPriority } from '../../lib/domain.js'
import { todayISO, isoDate, fmtTime, fmtLongDate, relativeDay } from '../../lib/format.js'
import { nextPendingTime } from '../../lib/reminders.js'
import { useTaskActions, addDays } from '../tasks/useTaskActions.js'
import TaskDetail from '../tasks/TaskDetail.jsx'
import TaskEditor from '../tasks/TaskEditor.jsx'
import { ApptEditor } from '../appointments/AppointmentsScreen.jsx'

// Plan: tasks, reminders and appointments in ONE list, grouped by day, with a
// week strip on top. Tap a day to see just that day; tap a task to see its
// details and act on it. The full task list (filters, completed, delegated)
// stays one tap away in the top bar.
const RANK = { critical: 0, high: 1, medium: 2, low: 3 }
const FILTERS = [['all', 'allTasks'], ['work', 'work'], ['personal', 'personal']]
const CAP = { later: 6, nodate: 5 }

export default function PlanScreen({ go }) {
  const { t, lang } = useT()
  const tasks = useCollection('tasks')
  const reminders = useCollection('reminders')
  const appointments = useCollection('appointments')
  const people = useCollection('people')
  const toast = useToast()
  const actions = useTaskActions(toast)
  const [filter, setFilter] = useState('all')
  const [day, setDay] = useState(null)            // selected date, or null for the grouped view
  const [detailId, setDetailId] = useState(null)  // task shown in the details panel
  const [editor, setEditor] = useState(null)      // task being edited
  const [appt, setAppt] = useState(null)          // appointment being edited
  const [more, setMore] = useState({})            // groups expanded past their cap

  const today = todayISO()
  const loc = lang === 'ar' ? 'ar' : 'en-US'

  // Everything with a date, in one shape.
  const items = useMemo(() => {
    const out = []
    tasks.items.forEach(x => {
      if (x.status === 'completed' || x.status === 'cancelled') return
      if (filter !== 'all' && (x.classification === 'work' ? 'work' : 'personal') !== filter) return
      out.push({ key: 't-' + x.id, kind: 'task', date: x.dueDate ? isoDate(x.dueDate) : '', time: x.dueTime || '', title: x.title, ref: x })
    })
    if (filter !== 'work') {
      reminders.items.forEach(r => {
        // A task's own alert lives with the task — don't list it twice.
        if (r.done || r.taskId) return
        const at = nextPendingTime(r) || r.remindAt
        if (!at) return
        const d = new Date(at)
        out.push({ key: 'r-' + r.id, kind: 'rem', date: isoDate(at), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, title: r.text, ref: r })
      })
      appointments.items.forEach(a => {
        if (!a.date || isoDate(a.date) < today) return
        out.push({ key: 'a-' + a.id, kind: 'appt', date: isoDate(a.date), time: a.time || '', title: a.title, ref: a })
      })
    }
    // Timed items first, in time order; then untimed by priority.
    return out.sort((a, b) => (a.date || '9').localeCompare(b.date || '9')
      || (a.time || '99').localeCompare(b.time || '99')
      || ((RANK[a.ref.priority] ?? 9) - (RANK[b.ref.priority] ?? 9)))
  }, [tasks.items, reminders.items, appointments.items, filter, today])

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const countOn = (d) => items.filter(x => x.date === d).length
  const utc = (iso) => new Date(iso + 'T00:00:00Z')

  const tomorrow = addDays(today, 1), weekEnd = addDays(today, 6)
  const groups = day
    ? [{ id: 'day', title: day === today ? t('today') : day === tomorrow ? t('tomorrow') : fmtLongDate(day, lang), list: items.filter(x => x.date === day) }]
    : [
      { id: 'overdue', title: t('overdue'), danger: true, list: items.filter(x => x.date && x.date < today) },
      { id: 'today', title: t('today'), list: items.filter(x => x.date === today) },
      { id: 'tomorrow', title: t('tomorrow'), list: items.filter(x => x.date === tomorrow) },
      { id: 'week', title: t('thisWeek'), list: items.filter(x => x.date > tomorrow && x.date <= weekEnd) },
      { id: 'later', title: t('later'), list: items.filter(x => x.date > weekEnd) },
      { id: 'nodate', title: t('noDate'), list: items.filter(x => !x.date) },
    ].filter(g => g.list.length)

  const doneReminder = (r) => {
    reminders.patch(r.id, { done: true })
    toast.show('✓ ' + t('completed'), [{ label: t('undo'), onClick: () => reminders.patch(r.id, { done: false }) }])
  }

  // What to show under a row's title. Inside a single day the date is implied.
  const meta = (it, g) => {
    const parts = []
    const multiDay = g.id === 'overdue' || g.id === 'week' || g.id === 'later'
    if (multiDay && it.date) parts.push(relativeDay(it.date, lang))
    if (it.time) parts.push(fmtTime(it.time, lang))
    if (it.kind === 'rem') parts.push(t('cap_reminder'))
    if (it.kind === 'appt') parts.push(it.ref.location || t('cap_appointment'))
    if (it.kind === 'task' && it.ref.assignedTo) parts.push(it.ref.assignedTo)
    return parts.join(' · ')
  }

  const row = (it, g) => {
    const pr = it.kind === 'task' && (it.ref.priority === 'critical' || it.ref.priority === 'high') ? findPriority(it.ref.priority) : null
    const open = () => it.kind === 'task' ? setDetailId(it.ref.id) : it.kind === 'appt' ? setAppt(it.ref) : go('reminders')
    const m = meta(it, g)
    return (
      <div className="li" key={it.key}>
        {it.kind === 'appt' ? (
          <span className="lead t-brand" aria-hidden="true"><Icon name="calendar" size={18} /></span>
        ) : (
          <button className="check" aria-label={`${t('markDone')}: ${it.title}`}
            onClick={() => it.kind === 'task' ? actions.complete(it.ref) : doneReminder(it.ref)} />
        )}
        <button className="li-main" onClick={open}>
          <span className="body">
            <span className="title" style={{ display: 'block' }}>{it.title}</span>
            {(m || pr || it.kind === 'rem') && (
              <span className="meta">
                {pr && <span style={{ width: 8, height: 8, borderRadius: 4, background: pr.color, alignSelf: 'center', flexShrink: 0 }} aria-label={t(pr.key)} />}
                {it.kind === 'rem' && <Icon name="bell" size={14} style={{ alignSelf: 'center', flexShrink: 0 }} />}
                <span>{m}</span>
              </span>
            )}
          </span>
          <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        </button>
      </div>
    )
  }

  const detail = detailId && tasks.items.find(x => x.id === detailId)

  return (
    <>
      <TopBar title={t('plan')} right={
        <>
          <button className="iconbtn" onClick={() => go('calendar')} aria-label={t('calendar')}><Icon name="calendar" size={18} /></button>
          <button className="iconbtn" onClick={() => go('tasks')} aria-label={t('allTasksList')}><Icon name="check" size={18} /></button>
        </>
      } />
      <div className="screen">
        <div className="week-strip">
          {week.map(d => {
            const n = countOn(d)
            return (
              <button key={d} className={`wday${d === today ? ' today' : ''}`} aria-pressed={day === d}
                aria-label={`${fmtLongDate(d, lang)} · ${n}`} onClick={() => setDay(day === d ? null : d)}>
                <span className="wd">{utc(d).toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' })}</span>
                <span className="dd">{utc(d).toLocaleDateString(loc, { day: 'numeric', timeZone: 'UTC' })}</span>
                <span className="dots" aria-hidden="true">{Array.from({ length: Math.min(3, n) }, (_, i) => <i key={i} />)}</span>
              </button>
            )
          })}
        </div>

        <div className="chip-row">
          {FILTERS.map(([id, key]) => <Chip key={id} selectable on={filter === id} onClick={() => setFilter(id)}>{t(key)}</Chip>)}
        </div>

        {groups.length === 0 && !day && (
          <Empty icon="calendar" title={t('planEmpty')} text={t('planEmptyHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newTask')}</Button>} />
        )}

        {groups.map(g => {
          const cap = CAP[g.id] && !more[g.id] ? CAP[g.id] : Infinity
          return (
            <React.Fragment key={g.id}>
              <div className={`plan-h${g.danger ? ' danger' : ''}`}><Section title={g.title} count={g.list.length || undefined} /></div>
              {g.list.length === 0
                ? <p className="muted" style={{ margin: '0 2px' }}>{t('planNothingDay')}</p>
                : <div>{g.list.slice(0, cap).map(it => row(it, g))}</div>}
              {g.list.length > cap && (
                <button className="link-btn plan-more" onClick={() => setMore({ ...more, [g.id]: true })}>
                  {t('showAll')} ({g.list.length})
                </button>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {detail && (
        <TaskDetail task={detail} people={people.items} lang={lang}
          onClose={() => setDetailId(null)}
          onEdit={() => { setEditor(detail); setDetailId(null) }}
          onComplete={() => { actions.complete(detail); setDetailId(null) }}
          onSnooze={(when) => { actions.snooze(detail, when); setDetailId(null) }}
          onFollowUp={() => actions.followUp(detail)}
          onToggleSub={(id) => actions.toggleSub(detail, id)} />
      )}
      {editor && <TaskEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {appt && <ApptEditor initial={appt} onClose={() => setAppt(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}
