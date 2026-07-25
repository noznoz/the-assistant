import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty, Section } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { fmtLongDate, fmtTime, relativeDay, isOverdue } from '../../lib/format.js'
import { findPriority } from '../../lib/domain.js'

// Agenda-style calendar: tasks, service dates and renewals on one timeline.
export default function CalendarScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const vehicles = useCollection('vehicles')

  const groups = useMemo(() => {
    const events = []
    tasks.items.filter(x => x.dueDate && x.status !== 'completed' && x.status !== 'cancelled')
      .forEach(x => events.push({ date: x.dueDate, time: x.dueTime, title: x.title, kind: 'task', priority: x.priority, go: 'tasks' }))
    vehicles.items.forEach(v => { if (v.policyExpiry) events.push({ date: v.policyExpiry, title: `${v.nickname || v.name} — ${t('insurance')}`, kind: 'renewal', go: `garage/${v.id}` }) })
    events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    const byDate = {}
    events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e) })
    return Object.entries(byDate)
  }, [tasks.items, vehicles.items, lang])

  return (
    <>
      <DetailHeader title={t('calendar')} onBack={() => go('more')} />
      <div className="screen">
        {groups.length === 0 ? (
          <Empty icon="calendar" title={t('nothingHere')} text={t('noThingsToday')} />
        ) : groups.map(([date, evs]) => (
          <div key={date}>
            <div className="section-h" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 15 }}>{fmtLongDate(date, lang)}</h2>
              <span className="spacer" />
              <span className="count">{relativeDay(date, lang)}</span>
            </div>
            {evs.map((e, i) => {
              const pr = e.priority && findPriority(e.priority)
              return (
                <div className="li" key={i} onClick={() => go(e.go)}>
                  <div className={`lead ${e.kind === 'renewal' ? 't-warn' : 't-info'}`}>
                    <Icon name={e.kind === 'renewal' ? 'shield' : 'check'} size={18} />
                  </div>
                  <div className="body">
                    <div className="title" style={isOverdue(date) ? { color: 'var(--danger)' } : undefined}>{e.title}</div>
                    {e.time && <div className="meta">{fmtTime(e.time, lang)}</div>}
                  </div>
                  {pr && <span className="dot" style={{ width: 9, height: 9, borderRadius: 5, background: pr.color }} />}
                </div>
              )
            })}
          </div>
        ))}
        <p className="center muted" style={{ marginTop: 20, fontSize: 12 }}>Apple & Google Calendar sync arrive in Phase 2.</p>
      </div>
    </>
  )
}
