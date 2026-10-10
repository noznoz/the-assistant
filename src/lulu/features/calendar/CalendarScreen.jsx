import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Empty, Section, Button, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { fmtLongDate, fmtTime, relativeDay, isOverdue } from '../../lib/format.js'
import { findPriority } from '../../lib/domain.js'
import { buildICS } from '../../lib/ics.js'
import { buildRenewals } from '../../lib/renewals.js'
import { reminderTimes } from '../../lib/reminders.js'
import { prayerTimes, findCity } from '../../lib/prayer.js'

// Agenda-style calendar + one-tap export to the phone's Calendar app (.ics),
// so appointments, tasks, reminders, renewals and (optionally) prayer times get
// native alerts that fire even when this app is closed.
export default function CalendarScreen({ go }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const toast = useToast()
  const tasks = useCollection('tasks')
  const vehicles = useCollection('vehicles')
  const appointments = useCollection('appointments')
  const reminders = useCollection('reminders')
  const documents = useCollection('documents')
  const people = useCollection('people')
  const memberships = useCollection('memberships')
  const valuables = useCollection('valuables')
  const properties = useCollection('properties')
  const staff = useCollection('staff')

  const prayersOn = !!settings.prayerReminders
  const mins = Number(settings.prayerReminderMins) || 0

  const groups = useMemo(() => {
    const events = []
    tasks.items.filter(x => x.dueDate && x.status !== 'completed' && x.status !== 'cancelled')
      .forEach(x => events.push({ date: x.dueDate, time: x.dueTime, title: x.title, kind: 'task', priority: x.priority, go: 'tasks' }))
    vehicles.items.forEach(v => { if (v.policyExpiry) events.push({ date: v.policyExpiry, title: `${v.nickname || v.name} — ${t('insurance')}`, kind: 'renewal', go: `garage/${v.id}` }) })
    appointments.items.forEach(a => { if (a.date) events.push({ date: a.date, time: a.time, title: a.title || t('appointment'), kind: 'appt', go: 'appointments' }) })
    events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    const byDate = {}
    events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e) })
    return Object.entries(byDate)
  }, [tasks.items, vehicles.items, appointments.items, lang])

  const exportCal = async () => {
    const now = new Date()
    const evs = []
    appointments.items.filter(a => a.date).forEach(a => {
      if (a.time) evs.push({ start: new Date(`${a.date}T${a.time}:00`), durationMin: 60, summary: a.title || t('appointment'), location: a.location, desc: a.note, alarmMin: 30 })
      else evs.push({ allDay: true, date: a.date, summary: a.title || t('appointment') })
    })
    tasks.items.filter(x => x.dueDate && x.status !== 'completed' && x.status !== 'cancelled').forEach(x => {
      const sum = `✓ ${x.title}`
      if (x.dueTime) evs.push({ start: new Date(`${x.dueDate}T${x.dueTime}:00`), durationMin: 30, summary: sum, desc: x.description, alarmMin: 10 })
      else evs.push({ allDay: true, date: x.dueDate, summary: sum })
    })
    reminders.items.filter(r => !r.done).forEach(r => {
      reminderTimes(r).forEach(ts => { const d = new Date(ts); if (!isNaN(d)) evs.push({ start: d, durationMin: 15, summary: `🔔 ${r.text || t('reminder')}`, alarmMin: 0 }) })
    })
    buildRenewals({ people: people.items, vehicles: vehicles.items, documents: documents.items, memberships: memberships.items, valuables: valuables.items, properties: properties.items, staff: staff.items, t, lang })
      .filter(r => r.date && r.days != null && r.days >= -30 && r.days <= 180)
      .forEach(r => evs.push({ allDay: true, date: r.date, summary: `⏰ ${r.title}` }))
    if (prayersOn) {
      const city = findCity(settings.prayerCity)
      for (let i = 0; i < 30; i++) {
        const day = new Date(now.getTime() + i * 86400000)
        prayerTimes(day, city).forEach(p => { if (p.date.getTime() > now.getTime()) evs.push({ start: p.date, durationMin: 20, summary: `🕌 ${t(p.name)}`, alarmMin: mins }) })
      }
    }
    const ics = buildICS(evs, { name: 'The Assistant' })
    const file = new File([ics], 'the-assistant.ics', { type: 'text/calendar' })
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'The Assistant' }); return }
    } catch (e) { if (e && e.name === 'AbortError') return }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a'); a.href = url; a.download = 'the-assistant.ics'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
    toast.show(t('calendarExported'))
  }

  const MIN_OPTS = [{ v: 0, k: 'atTime' }, { v: 5, k: 'min5' }, { v: 10, k: 'min10' }, { v: 15, k: 'min15' }]

  return (
    <>
      <DetailHeader title={t('calendar')} onBack={() => go('more')} />
      <div className="screen">
        <Card style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="calendar" size={18} style={{ color: 'var(--brand-600)' }} />
            <h3 style={{ flex: 1, fontSize: 16 }}>{t('addToCalendar')}</h3>
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>{t('calendarSyncHint')}</p>

          <label className="consent-row" style={{ marginBottom: prayersOn ? 10 : 0 }}>
            <input type="checkbox" checked={prayersOn} onChange={e => updateSettings({ prayerReminders: e.target.checked })} />
            <span>{t('includePrayers')}</span>
          </label>
          {prayersOn && (
            <div className="chip-row" style={{ margin: '0 0 12px' }}>
              {MIN_OPTS.map(o => (
                <Chip key={o.v} selectable on={mins === o.v} onClick={() => updateSettings({ prayerReminderMins: o.v })}>{t(o.k)}</Chip>
              ))}
            </div>
          )}
          <Button block variant="primary" icon="calendar" onClick={exportCal}>{t('addToCalendar')}</Button>
        </Card>

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
                  <div className={`lead ${e.kind === 'renewal' ? 't-warn' : e.kind === 'appt' ? 't-brand' : 't-info'}`}>
                    <Icon name={e.kind === 'renewal' ? 'shield' : e.kind === 'appt' ? 'calendar' : 'check'} size={18} />
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
      </div>
      {toast.node}
    </>
  )
}
