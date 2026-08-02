import React, { useMemo, useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Empty, Button, Chip } from '../../ui/primitives.jsx'
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
  const documents = useCollection('documents')
  const [view, setView] = useState('timeline')

  const d = useMemo(() => {
    const within = (ds) => { const dd = daysUntil(ds); return dd != null && dd >= 0 && dd <= WK }
    const nameOf = (id) => (people.items.find(p => p.id === id) || {}).name
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
    const anniversaries = people.items.map(p => ({ p, dd: daysToBirthday(p.anniversary) })).filter(x => x.dd != null && x.dd <= WK).sort((a, b) => a.dd - b.dd)
    const upTrips = trips.items.filter(tr => { const dd = daysUntil(tr.start); return dd != null && dd >= 0 && dd <= 30 }).sort((a, b) => (a.start || '').localeCompare(b.start || ''))
    const weekAppts = appointments.items.filter(a => within(a.date)).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`))
    const weekDocs = documents.items.filter(dc => dc.expiry && (isOverdue(dc.expiry) || within(dc.expiry))).sort((a, b) => (a.expiry || '').localeCompare(b.expiry || ''))

    // Merged chronological agenda (one flat list, dated) for the timeline view.
    const iso = (dd) => new Date(Date.now() + dd * 86400000).toISOString().slice(0, 10)
    const agenda = []
    weekTasks.forEach(x => agenda.push({ key: 'tk' + x.id, date: x.dueDate, icon: 'check', tint: isOverdue(x.dueDate) ? 't-danger' : 't-info', title: x.title, meta: '', pr: findPriority(x.priority), go: 'tasks' }))
    bills.forEach((b, i) => agenda.push({ key: 'bl' + i, date: b.date, icon: b.kind === 'renewal' ? 'shield' : 'wallet', tint: b.kind === 'income' ? 't-ok' : b.kind === 'renewal' ? 't-danger' : 't-warn', title: b.title, amount: b.amount, kind: b.kind, go: b.kind === 'renewal' ? 'renewals' : 'moneycal' }))
    weekAppts.forEach(a => agenda.push({ key: 'ap' + a.id, date: a.date, time: a.time, icon: 'calendar', tint: 't-brand', title: a.title + (nameOf(a.personId) ? ` · ${nameOf(a.personId)}` : ''), meta: a.time || '', go: 'appointments' }))
    weekDocs.forEach(dc => agenda.push({ key: 'dc' + dc.id, date: dc.expiry, icon: 'doc', tint: isOverdue(dc.expiry) ? 't-danger' : 't-warn', title: `${dc.title} — ${t('policyExpiry')}`, meta: '', go: 'documents' }))
    birthdays.forEach(x => agenda.push({ key: 'bd' + x.p.id, date: iso(x.dd), icon: 'cake', tint: 't-brand', title: `${x.p.name} — ${t('birthdaySoon')}`, meta: '', go: 'people' }))
    anniversaries.forEach(x => agenda.push({ key: 'an' + x.p.id, date: iso(x.dd), icon: 'cake', tint: 't-brand', title: `${x.p.name} — ${t('anniversary')}`, meta: '', go: 'people' }))
    upTrips.filter(tr => within(tr.start)).forEach(tr => agenda.push({ key: 'tr' + tr.id, date: tr.start, icon: 'trip', tint: 't-info', title: tr.name, meta: tr.destination || '', go: 'trips' }))
    agenda.sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`))

    return { weekTasks, bills, dueOut, expectIn, birthdays, anniversaries, upTrips, weekAppts, weekDocs, agenda }
  }, [tasks.items, subs.items, vehicles.items, income.items, people.items, trips.items, appointments.items, documents.items, rates, lang])

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
            <div className="chip-row" style={{ margin: '6px 0 10px' }}>
              <Chip selectable on={view === 'timeline'} onClick={() => setView('timeline')}><Icon name="today" size={13} /> {t('timeline')}</Chip>
              <Chip selectable on={view === 'grouped'} onClick={() => setView('grouped')}><Icon name="grid" size={13} /> {t('byType')}</Chip>
            </div>

            {view === 'timeline' && <TimelineView agenda={d.agenda} upTrips={d.upTrips} within={WK} lang={lang} cur={cur} go={go} t={t} />}

            {view === 'grouped' && <>
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

            </>}

            <Button block variant="brand" icon="whatsapp" style={{ marginTop: 16 }} onClick={shareDigest}>{t('shareWeekAhead')}</Button>
          </>
        )}
      </div>
    </>
  )
}

// Merged day-by-day timeline. Overdue items surface first, then each upcoming
// day gets its own header with everything due that day in one chronological run.
function TimelineView({ agenda, upTrips, lang, cur, go, t }) {
  const today = new Date().toISOString().slice(0, 10)
  const groups = {}
  agenda.forEach(it => { (groups[it.date] = groups[it.date] || []).push(it) })
  const days = Object.keys(groups).sort()
  const overdueDays = days.filter(dt => dt < today)
  const futureDays = days.filter(dt => dt >= today)
  const laterTrips = (upTrips || []).filter(tr => tr.start && tr.start > today && daysUntil(tr.start) > 7)

  const Rows = ({ items }) => items.map(it => (
    <div key={it.key} className="li" onClick={() => go(it.go)}>
      <div className={`lead ${it.tint}`}>{it.pr ? <span style={{ width: 9, height: 9, borderRadius: 5, background: it.pr.color }} /> : <Icon name={it.icon} size={17} />}</div>
      <div className="body"><div className="title" style={{ fontSize: 14 }}>{it.title}</div>{it.meta && <div className="meta">{it.meta}</div>}</div>
      {it.amount > 0 && <b className={`tnum ${it.kind === 'income' ? 't-ok' : ''}`} style={{ fontSize: 13 }}>{it.kind === 'income' ? '+' : ''}{money(it.amount, cur, lang)}</b>}
    </div>
  ))

  const DayBlock = ({ dt, label, danger }) => (
    <React.Fragment key={dt || label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 2px 6px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 750, color: danger ? 'var(--danger)' : 'var(--ink-2)', textTransform: 'capitalize' }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span className="chip">{groups[dt].length}</span>
      </div>
      <Card tight>{<Rows items={groups[dt]} />}</Card>
    </React.Fragment>
  )

  return (
    <div style={{ marginTop: 4 }}>
      {overdueDays.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 2px 6px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--danger)' }}>{t('overdue')}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <Card tight>{<Rows items={overdueDays.flatMap(dt => groups[dt])} />}</Card>
        </>
      )}
      {futureDays.map(dt => <DayBlock key={dt} dt={dt} label={dt === today ? t('today') : relativeDay(dt, lang)} />)}
      {laterTrips.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 2px 6px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--ink-2)' }}>{t('upcoming')}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <Card tight>{laterTrips.map(tr => (
            <div key={'lt' + tr.id} className="li" onClick={() => go('trips')}>
              <div className="lead t-info"><Icon name="trip" size={17} /></div>
              <div className="body"><div className="title" style={{ fontSize: 14 }}>{tr.name}</div><div className="meta">{tr.destination}{tr.start ? ` · ${relativeDay(tr.start, lang)}` : ''}</div></div>
            </div>
          ))}</Card>
        </>
      )}
    </div>
  )
}
