import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { isOverdue, isToday, daysUntil, fmtDate, relativeDay } from '../../lib/format.js'

// A live notification feed derived from tasks, renewals and documents.
export default function NotificationsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const vehicles = useCollection('vehicles')
  const services = useCollection('services')
  const docs = useCollection('documents')

  const feed = useMemo(() => {
    const out = []
    const open = tasks.items.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
    open.filter(x => isOverdue(x.dueDate)).forEach(x => out.push({ id: 't' + x.id, tint: 't-danger', icon: 'clock', title: x.title, meta: t('overdue'), go: 'tasks/overdue', sort: -1 }))
    open.filter(x => isToday(x.dueDate)).forEach(x => out.push({ id: 'd' + x.id, tint: 't-info', icon: 'today', title: x.title, meta: t('todaysTasks'), go: 'tasks/today', sort: 0 }))
    open.filter(x => x.status === 'waiting_me').forEach(x => out.push({ id: 'w' + x.id, tint: 't-warn', icon: 'flag', title: x.title, meta: t('waitingForMe'), go: 'tasks/waiting_me', sort: 1 }))
    // Assigned/delegated tasks (to family or others) that need chasing.
    open.filter(x => (x.assigneeId || x.assignedTo) && (isOverdue(x.dueDate) || isToday(x.dueDate) || x.status === 'waiting_someone'))
      .forEach(x => out.push({ id: 'a' + x.id, tint: isOverdue(x.dueDate) ? 't-danger' : 't-warn', icon: 'people', title: x.title, meta: `${t('waitingOn')} ${x.assignedTo || ''}`.trim(), go: 'tasks/delegated', sort: isOverdue(x.dueDate) ? -0.5 : 1.5 }))
    vehicles.items.forEach(v => { const dd = daysUntil(v.policyExpiry); if (dd != null && dd <= 45) out.push({ id: 'v' + v.id, tint: dd <= 14 ? 't-danger' : 't-warn', icon: 'shield', title: `${v.nickname || v.name} — ${t('insurance')}`, meta: `${t('policyExpiry')}: ${fmtDate(v.policyExpiry, lang, settings.dateFormat)}`, go: `garage/${v.id}`, sort: dd }) })
    // Upcoming vehicle service (by next-service date).
    services.items.forEach(s => { const dd = daysUntil(s.nextDate); if (dd != null && dd <= 30) { const v = vehicles.items.find(x => x.id === s.vehicleId); out.push({ id: 'svc' + s.id, tint: dd <= 7 ? 't-danger' : 't-warn', icon: 'wrench', title: `${v ? (v.nickname || v.name) : ''} — ${t('serviceDue')}`, meta: `${s.work} · ${fmtDate(s.nextDate, lang, settings.dateFormat)}`, go: v ? `garage/${v.id}` : 'garage', sort: dd }) } })
    docs.items.forEach(d => { const dd = daysUntil(d.expiry); if (dd != null && dd <= 30) out.push({ id: 'doc' + d.id, tint: dd <= 7 ? 't-danger' : 't-warn', icon: 'doc', title: d.title, meta: `${t('policyExpiry')}: ${relativeDay(d.expiry, lang)}`, go: 'documents', sort: dd }) })
    return out.sort((a, b) => a.sort - b.sort)
  }, [tasks.items, vehicles.items, services.items, docs.items, lang])

  return (
    <>
      <DetailHeader title={t('notifications')} onBack={() => go('today')} />
      <div className="screen">
        {feed.length === 0 ? (
          <Empty icon="bell" title={t('nothingHere')} text={t('noThingsToday')} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {feed.map(n => (
              <div className="li" key={n.id} onClick={() => go(n.go)}>
                <div className={`lead ${n.tint}`}><Icon name={n.icon} size={18} /></div>
                <div className="body"><div className="title">{n.title}</div><div className="meta">{n.meta}</div></div>
                <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
