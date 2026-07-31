import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Empty, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, toSar, fmtLongDate, fmtDate, relativeDay, daysUntil, isOverdue, isToday } from '../../lib/format.js'
import { findPriority } from '../../lib/domain.js'
import { share } from '../../lib/share.js'

const WK = 7

function daysToBirthday(bStr) {
  if (!bStr) return null
  const b = new Date(bStr); if (isNaN(b)) return null
  const today = new Date(new Date().toISOString().slice(0, 10))
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

export default function WeekScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const tasks = useCollection('tasks')
  const subs = useCollection('subscriptions')
  const vehicles = useCollection('vehicles')
  const income = useCollection('income')
  const people = useCollection('people')
  const trips = useCollection('trips')
  const appointments = useCollection('appointments')

  const d = useMemo(() => {
    const within = (ds) => { const dd = daysUntil(ds); return dd != null && dd >= 0 && dd <= WK }
    const openTasks = tasks.items.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
    const weekTasks = openTasks.filter(x => x.dueDate && (isOverdue(x.dueDate) || within(x.dueDate))).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

    let dueOut = 0, expectIn = 0
    const bills = []
    subs.items.filter(s => s.active !== false).forEach(s => { if (within(s.nextDue)) { const a = toSar(s.amount, s.currency || 'SAR', rates); dueOut += a; bills.push({ title: s.name, date: s.nextDue, amount: a, kind: 'bill' }) } })
    vehicles.items.forEach(v => { if (within(v.policyExpiry)) bills.push({ title: `${v.nickname || v.name} — ${t('insurance')}`, date: v.policyExpiry, amount: 0, kind: 'renewal' }) })
    income.items.filter(i => i.recurring).forEach(i => {
      const base = new Date(i.date); if (isNaN(base)) return
      const now = new Date()
      const next = new Date(base.getFullYear(), now.getMonth() + (now.getDate() > base.getDate() ? 1 : 0), base.getDate())
      if (within(next.toISOString().slice(0, 10))) { const a = toSar(i.amount, i.currency || 'SAR', rates); expectIn += a; bills.push({ title: i.note || t('income'), date: next.toISOString().slice(0, 10), amount: a, kind: 'income' }) }
    })
    bills.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    const birthdays = people.items.map(p => ({ p, dd: daysToBirthday(p.birthday) })).filter(x => x.dd != null && x.dd <= WK).sort((a, b) => a.dd - b.dd)
    const upTrips = trips.items.filter(tr => { const dd = daysUntil(tr.start); return dd != null && dd >= 0 && dd <= 30 }).sort((a, b) => (a.start || '').localeCompare(b.start || ''))
    const weekAppts = appointments.items.filter(a => within(a.date)).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`))

    return { weekTasks, bills, dueOut, expectIn, birthdays, upTrips, weekAppts }
  }, [tasks.items, subs.items, vehicles.items, income.items, people.items, trips.items, appointments.items, rates, lang])

  const shareDigest = () => {
    const L = lang === 'ar'
    const lines = [`🗓️ ${L ? 'ملخص الأسبوع' : 'Week ahead'} · ${fmtLongDate(new Date(), lang)}`, '']
    if (d.weekTasks.length) { lines.push(`✅ ${t('tasks')} (${d.weekTasks.length})`); d.weekTasks.slice(0, 8).forEach(x => lines.push(`• ${x.title}${x.dueDate ? ` — ${relativeDay(x.dueDate, lang)}` : ''}`)); lines.push('') }
    if (d.dueOut || d.expectIn) { lines.push(`💳 ${t('dueOut')}: ${money(d.dueOut, cur, lang)} · ${t('expectedIn')}: ${money(d.expectIn, cur, lang)}`, '') }
    if (d.birthdays.length) { lines.push(`🎂 ${d.birthdays.map(x => x.p.name).join(', ')}`) }
    lines.push('', '— The Assistant')
    share(lines.join('\n'))
  }

  const nameFor = (id) => (people.items.find(p => p.id === id) || {}).name
  const empty = !d.weekTasks.length && !d.bills.length && !d.birthdays.length && !d.upTrips.length && !d.weekAppts.length

  return (
    <>
      <DetailHeader title={t('weekAhead')} onBack={() => go('today')} right={
        <button className="iconbtn" onClick={shareDigest} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        <p className="muted" style={{ margin: '14px 2px 4px' }}>{fmtLongDate(new Date(), lang)}</p>

        {empty ? (
          <Empty icon="sparkle" title={t('allClear')} text={t('weekEmptyHint')} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 8 }}>
              <div className="card" style={{ textAlign: 'center', padding: 14 }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>{t('dueOut')}</div>
                <b className="tnum t-danger" style={{ fontSize: 18 }}>{money(d.dueOut, cur, lang)}</b>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 14 }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>{t('expectedIn')}</div>
                <b className="tnum t-ok" style={{ fontSize: 18 }}>{money(d.expectIn, cur, lang)}</b>
              </div>
            </div>

            {d.weekTasks.length > 0 && (
              <>
                <Section title={t('tasksThisWeek')} count={d.weekTasks.length} action={t('view')} onAction={() => go('tasks')} />
                <Card tight>
                  {d.weekTasks.slice(0, 8).map(x => {
                    const pr = findPriority(x.priority)
                    const over = isOverdue(x.dueDate)
                    return (
                      <div key={x.id} className="li" style={{ margin: 0, border: 0, borderRadius: 0 }} onClick={() => go('tasks')}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: pr?.color || 'var(--ink-3)', flexShrink: 0 }} />
                        <div className="body"><div className="title" style={{ fontSize: 14 }}>{x.title}</div></div>
                        <span className={`meta ${over ? 't-danger' : ''}`}>{relativeDay(x.dueDate, lang)}</span>
                      </div>
                    )
                  })}
                </Card>
              </>
            )}

            {d.bills.length > 0 && (
              <>
                <Section title={t('moneyThisWeek')} action={t('view')} onAction={() => go('moneycal')} />
                {d.bills.map((b, i) => (
                  <div className="li" key={i}>
                    <div className={`lead ${b.kind === 'income' ? 't-ok' : b.kind === 'renewal' ? 't-danger' : 't-warn'}`}><Icon name={b.kind === 'income' ? 'wallet' : b.kind === 'renewal' ? 'shield' : 'wallet'} size={18} /></div>
                    <div className="body"><div className="title">{b.title}</div><div className="meta">{relativeDay(b.date, lang)}</div></div>
                    {b.amount > 0 && <b className={`tnum ${b.kind === 'income' ? 't-ok' : ''}`}>{b.kind === 'income' ? '+' : ''}{money(b.amount, cur, lang)}</b>}
                  </div>
                ))}
              </>
            )}

            {d.weekAppts.length > 0 && (
              <>
                <Section title={t('appointments')} count={d.weekAppts.length} action={t('view')} onAction={() => go('appointments')} />
                {d.weekAppts.map(a => (
                  <div className="li" key={'ap' + a.id} onClick={() => go('appointments')}>
                    <div className="lead t-brand"><Icon name="calendar" size={18} /></div>
                    <div className="body"><div className="title">{a.title}{nameFor(a.personId) ? ` · ${nameFor(a.personId)}` : ''}</div><div className="meta">{relativeDay(a.date, lang)}{a.time ? ` · ${a.time}` : ''}</div></div>
                  </div>
                ))}
              </>
            )}

            {(d.birthdays.length > 0 || d.upTrips.length > 0) && (
              <>
                <Section title={t('upcoming')} />
                {d.birthdays.map(x => (
                  <div className="li" key={'b' + x.p.id} onClick={() => go('people')}>
                    <div className="lead t-brand"><Icon name="cake" size={18} /></div>
                    <div className="body"><div className="title">{x.p.name} — {t('birthdaySoon')}</div><div className="meta">{x.dd === 0 ? relativeDay(new Date().toISOString(), lang) : relativeDay(new Date(Date.now() + x.dd * 86400000).toISOString(), lang)}</div></div>
                  </div>
                ))}
                {d.upTrips.map(tr => (
                  <div className="li" key={'t' + tr.id} onClick={() => go('trips')}>
                    <div className="lead t-info"><Icon name="trip" size={18} /></div>
                    <div className="body"><div className="title">{tr.name}</div><div className="meta">{tr.destination}{tr.start ? ` · ${relativeDay(tr.start, lang)}` : ''}</div></div>
                  </div>
                ))}
              </>
            )}

            <Button block variant="brand" icon="whatsapp" style={{ marginTop: 16 }} onClick={shareDigest}>{t('shareWeekAhead')}</Button>
          </>
        )}
      </div>
    </>
  )
}
