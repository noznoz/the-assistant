import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, toSar, expenseSar, isOverdue, daysUntil, fmtLongDate, relativeDay } from '../../lib/format.js'
import { taskMemberIds } from '../../lib/org.js'
import { share, emailShare } from '../../lib/share.js'

function daysToAnnual(str) {
  if (!str) return null
  const b = new Date(str); if (isNaN(b)) return null
  const today = new Date(new Date().toISOString().slice(0, 10))
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

// A one-glance monthly "board pack": cashflow, work delivery and the household
// horizon, in one screen you can review, share or print.
export default function BoardPackScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const expenses = useCollection('expenses')
  const income = useCollection('income')
  const tasks = useCollection('tasks')
  const departments = useCollection('departments')
  const members = useCollection('members')
  const vehicles = useCollection('vehicles')
  const appointments = useCollection('appointments')
  const documents = useCollection('documents')
  const people = useCollection('people')

  const now = new Date()
  const inThisMonth = (ds) => { const d = new Date(ds); return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }

  const r = useMemo(() => {
    // Cashflow
    const spend = expenses.items.filter(e => inThisMonth(e.date)).reduce((s, e) => s + expenseSar(e, rates), 0)
    const recurIncome = income.items.filter(i => i.recurring).reduce((s, i) => s + toSar(i.amount, i.currency, rates), 0)
    const oneOffIncome = income.items.filter(i => !i.recurring && inThisMonth(i.date)).reduce((s, i) => s + toSar(i.amount, i.currency, rates), 0)
    const inc = recurIncome + oneOffIncome
    const net = inc - spend
    // Work
    const work = tasks.items.filter(x => x.classification === 'work' && x.status !== 'cancelled')
    const open = work.filter(x => x.status !== 'completed')
    const overdue = open.filter(x => isOverdue(x.dueDate))
    const doneMonth = work.filter(x => x.status === 'completed' && inThisMonth(x.completedAt || x.updatedAt))
    const doneAll = work.filter(x => x.status === 'completed')
    const onTime = doneAll.filter(x => !x.dueDate || (x.updatedAt && x.updatedAt.slice(0, 10) <= x.dueDate)).length
    const onTimePct = doneAll.length ? Math.round(onTime / doneAll.length * 100) : null
    const byDept = departments.items.map(dep => ({ dep, open: open.filter(x => x.departmentId === dep.id).length, overdue: overdue.filter(x => x.departmentId === dep.id).length })).filter(x => x.open > 0).sort((a, b) => b.open - a.open)
    // Household horizon
    const renewals = vehicles.items.map(v => ({ v, dd: daysUntil(v.policyExpiry) })).filter(x => x.dd != null && x.dd <= 45).sort((a, b) => a.dd - b.dd)
    const docsSoon = documents.items.map(dc => ({ dc, dd: daysUntil(dc.expiry) })).filter(x => x.dd != null && x.dd <= 45).sort((a, b) => a.dd - b.dd)
    const apptsSoon = appointments.items.map(a => ({ a, dd: daysUntil(a.date) })).filter(x => x.dd != null && x.dd >= 0 && x.dd <= 14).sort((a, b) => a.dd - b.dd)
    const occasions = people.items.map(p => ({ p, dd: daysToAnnual(p.birthday) })).filter(x => x.dd != null && x.dd <= 30).sort((a, b) => a.dd - b.dd)
    return { spend, inc, net, open, overdue, doneMonth, onTimePct, byDept, renewals, docsSoon, apptsSoon, occasions }
  }, [expenses.items, income.items, tasks.items, departments.items, vehicles.items, appointments.items, documents.items, people.items, rates])

  const monthLabel = now.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' })

  const text = useMemo(() => {
    const L = []
    L.push(`📋 ${t('boardPack')} — ${monthLabel}`, '')
    L.push(`💰 ${t('cashflow')}`)
    L.push(`• ${t('income')}: ${money(r.inc, cur, lang)}`)
    L.push(`• ${t('spending')}: ${money(r.spend, cur, lang)}`)
    L.push(`• ${t('net')}: ${money(r.net, cur, lang)}`, '')
    L.push(`🗂️ ${t('work')}`)
    L.push(`• ${t('openLabel')}: ${r.open.length} · ${t('overdue')}: ${r.overdue.length}`)
    L.push(`• ${t('completedThisMonth')}: ${r.doneMonth.length}${r.onTimePct != null ? ` · ${r.onTimePct}% ${t('onTime')}` : ''}`)
    r.byDept.slice(0, 5).forEach(({ dep, open }) => L.push(`   – ${dep.name}: ${open}`))
    L.push('')
    L.push(`🏠 ${t('householdHorizon')}`)
    if (r.renewals.length) L.push(`• ${t('renewals')}: ${r.renewals.map(x => `${x.v.nickname || x.v.name} (${x.dd}d)`).join(', ')}`)
    if (r.docsSoon.length) L.push(`• ${t('documents')}: ${r.docsSoon.map(x => `${x.dc.title} (${x.dd}d)`).join(', ')}`)
    if (r.apptsSoon.length) L.push(`• ${t('appointments')}: ${r.apptsSoon.length}`)
    if (r.occasions.length) L.push(`• ${t('occasions')}: ${r.occasions.map(x => x.p.name).join(', ')}`)
    L.push('', '— The Assistant')
    return L.join('\n').trim()
  }, [r, lang])

  return (
    <>
      <DetailHeader title={t('boardPack')} onBack={() => go('reports')} right={
        <button className="iconbtn" onClick={() => share(text)} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        <p className="muted" style={{ margin: '14px 2px 2px', fontWeight: 650 }}>{monthLabel}</p>
        <p className="muted" style={{ margin: '0 2px 8px', fontSize: 12 }}>{fmtLongDate(now, lang)}</p>

        {/* Cashflow */}
        <Section title={t('cashflow')} />
        <div className="stat-grid">
          <Stat label={t('income')} value={money(r.inc, cur, lang)} onClick={() => go('income')} />
          <Stat label={t('spending')} value={money(r.spend, cur, lang)} onClick={() => go('expenses')} />
        </div>
        <Card style={{ marginTop: 12, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('net')}</div>
          <div className={`tnum ${r.net >= 0 ? 't-ok' : 't-danger'}`} style={{ fontSize: 30, fontWeight: 780, marginTop: 4 }}>{money(r.net, cur, lang)}</div>
        </Card>

        {/* Work */}
        <Section title={t('work')} action={t('view')} onAction={() => go('workboard')} />
        <div className="stat-grid">
          <Stat label={t('openLabel')} value={String(r.open.length)} />
          <Stat label={t('overdue')} value={String(r.overdue.length)} sub={r.overdue.length ? t('needsAttention') : ''} />
          <Stat label={t('completedThisMonth')} value={String(r.doneMonth.length)} />
          <Stat label={t('onTime')} value={r.onTimePct == null ? '—' : `${r.onTimePct}%`} />
        </div>
        {r.byDept.length > 0 && (
          <Card tight style={{ marginTop: 12 }}>
            {r.byDept.map(({ dep, open, overdue }) => (
              <div className="li" key={dep.id} onClick={() => go(`work/${dep.id}`)}>
                <div className="lead t-brand"><Icon name="report" size={17} /></div>
                <div className="body"><div className="title">{dep.name}</div><div className="meta">{open} {t('tasksLower')}{overdue > 0 ? ` · ${overdue} ${t('overdue').toLowerCase()}` : ''}</div></div>
                <b className="tnum">{open}</b>
              </div>
            ))}
          </Card>
        )}

        {/* Household horizon */}
        <Section title={t('householdHorizon')} />
        <Card tight>
          {r.renewals.length === 0 && r.docsSoon.length === 0 && r.apptsSoon.length === 0 && r.occasions.length === 0 && (
            <div className="muted" style={{ padding: 14, textAlign: 'center' }}>{t('allClear')}</div>
          )}
          {r.renewals.map(({ v, dd }) => (
            <div className="li" key={'rn' + v.id} onClick={() => go(`garage/${v.id}`)}>
              <div className="lead t-warn"><Icon name="shield" size={17} /></div>
              <div className="body"><div className="title">{v.nickname || v.name} — {t('insurance')}</div><div className="meta">{relativeDay(v.policyExpiry, lang)}</div></div>
              <span className={`chip ${dd <= 14 ? 't-danger' : 't-warn'}`}>{dd}d</span>
            </div>
          ))}
          {r.docsSoon.map(({ dc, dd }) => (
            <div className="li" key={'dc' + dc.id} onClick={() => go('documents')}>
              <div className="lead t-warn"><Icon name="doc" size={17} /></div>
              <div className="body"><div className="title">{dc.title}</div><div className="meta">{relativeDay(dc.expiry, lang)}</div></div>
              <span className={`chip ${dd <= 14 ? 't-danger' : 't-warn'}`}>{dd}d</span>
            </div>
          ))}
          {r.apptsSoon.map(({ a, dd }) => (
            <div className="li" key={'ap' + a.id} onClick={() => go('appointments')}>
              <div className="lead t-brand"><Icon name="calendar" size={17} /></div>
              <div className="body"><div className="title">{a.title}</div><div className="meta">{relativeDay(a.date, lang)}{a.time ? ` · ${a.time}` : ''}</div></div>
            </div>
          ))}
          {r.occasions.map(({ p, dd }) => (
            <div className="li" key={'oc' + p.id} onClick={() => go('occasions')}>
              <div className="lead t-brand"><Icon name="cake" size={17} /></div>
              <div className="body"><div className="title">{p.name} — {t('birthdaySoon')}</div><div className="meta">{dd === 0 ? relativeDay(new Date().toISOString(), lang) : relativeDay(new Date(Date.now() + dd * 86400000).toISOString(), lang)}</div></div>
            </div>
          ))}
        </Card>

        <div className="row2" style={{ marginTop: 18 }}>
          <Button icon="whatsapp" onClick={() => share(text)}>{t('shareWhatsApp')}</Button>
          <Button icon="mail" onClick={() => emailShare(`${t('boardPack')} — ${monthLabel}`, text)}>{t('email')}</Button>
        </div>
        <Button block icon="doc" style={{ marginTop: 10 }} onClick={() => window.print()}>{t('print')}</Button>
      </div>
    </>
  )
}
