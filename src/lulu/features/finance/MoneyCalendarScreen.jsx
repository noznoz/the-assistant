import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty, Section } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, fmtDate, relativeDay, daysUntil, toSar, expenseSar } from '../../lib/format.js'

const HORIZON = 92 // days to look ahead

function addMonths(dateStr, n) {
  const d = new Date(dateStr); if (isNaN(d)) return null
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}
function iso(d) { return d.toISOString().slice(0, 10) }
function monthsElapsed(dateStr) {
  const d = new Date(dateStr); if (isNaN(d)) return 0
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

// A forward-looking money calendar: bills, installment payments, renewals and
// expected income for the next ~3 months, on one timeline.
export default function MoneyCalendarScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const subs = useCollection('subscriptions')
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const income = useCollection('income')

  const events = useMemo(() => {
    const out = []
    const today = new Date(new Date().toISOString().slice(0, 10))
    const within = (dStr) => { const dd = daysUntil(dStr); return dd != null && dd >= 0 && dd <= HORIZON }

    subs.items.filter(s => s.active !== false).forEach(s => {
      if (within(s.nextDue)) out.push({ date: s.nextDue, title: s.name, amount: toSar(s.amount, s.currency || 'SAR', rates), kind: 'bill', icon: 'wallet', tint: 't-warn' })
    })
    expenses.items.filter(e => e.method === 'installment' && Number(e.installmentMonths) > 0).forEach(e => {
      const months = Number(e.installmentMonths)
      const paid = Math.max(0, monthsElapsed(e.date))
      if (paid < months) {
        const next = addMonths(e.date, paid + 1)
        if (next && within(iso(next))) out.push({ date: iso(next), title: `${e.item || e.merchant || t('installment')} · ${paid + 1}/${months}`, amount: expenseSar(e, rates) / months, kind: 'installment', icon: 'refresh', tint: 't-info' })
      }
    })
    vehicles.items.forEach(v => { if (within(v.policyExpiry)) out.push({ date: v.policyExpiry, title: `${v.nickname || v.name} — ${t('insurance')}`, amount: 0, kind: 'renewal', icon: 'shield', tint: 't-danger' }) })
    income.items.filter(i => i.recurring).forEach(i => {
      const next = addMonths(i.date, Math.max(1, monthsElapsed(i.date) + 1))
      if (next && within(iso(next))) out.push({ date: iso(next), title: i.note || t('income'), amount: toSar(i.amount, i.currency || 'SAR', rates), kind: 'income', icon: 'wallet', tint: 't-ok' })
    })

    out.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const byDate = {}
    out.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e) })
    return Object.entries(byDate)
  }, [subs.items, expenses.items, vehicles.items, income.items, rates, lang])

  const totalOut = events.flatMap(([, evs]) => evs).filter(e => e.kind !== 'income' && e.kind !== 'renewal').reduce((s, e) => s + e.amount, 0)
  const totalIn = events.flatMap(([, evs]) => evs).filter(e => e.kind === 'income').reduce((s, e) => s + e.amount, 0)

  return (
    <>
      <DetailHeader title={t('moneyCalendar')} onBack={() => go('expenses')} />
      <div className="screen">
        {events.length === 0 ? (
          <Empty icon="calendar" title={t('nothingHere')} text={t('moneyCalHint')} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <div className="card" style={{ textAlign: 'center', padding: 14 }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>{t('dueOut')}</div>
                <b className="tnum t-danger" style={{ fontSize: 18 }}>{money(totalOut, cur, lang)}</b>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 14 }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>{t('expectedIn')}</div>
                <b className="tnum t-ok" style={{ fontSize: 18 }}>{money(totalIn, cur, lang)}</b>
              </div>
            </div>
            <p className="hint center" style={{ marginTop: 8 }}>{t('next3Months')}</p>

            {events.map(([date, evs]) => (
              <div key={date}>
                <div className="section-h" style={{ marginBottom: 8, marginTop: 10 }}>
                  <h2 style={{ fontSize: 15 }}>{fmtDate(date, lang, settings.dateFormat)}</h2>
                  <span className="spacer" />
                  <span className="count">{relativeDay(date, lang)}</span>
                </div>
                {evs.map((e, i) => (
                  <div className="li" key={i}>
                    <div className={`lead ${e.tint}`}><Icon name={e.icon} size={18} /></div>
                    <div className="body"><div className="title">{e.title}</div><div className="meta">{t(e.kind === 'income' ? 'income' : e.kind === 'renewal' ? 'renewal' : e.kind === 'installment' ? 'installment' : 'bill')}</div></div>
                    {e.amount > 0 && <b className={`tnum ${e.kind === 'income' ? 't-ok' : ''}`}>{e.kind === 'income' ? '+' : ''}{money(e.amount, cur, lang)}</b>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
