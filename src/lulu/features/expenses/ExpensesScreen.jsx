import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Card, Section, Stat, Segmented, Bars, Fab, Empty, Button, Sheet, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { findCategory, findPayment, label } from '../../lib/domain.js'
import { money, fmtDate, isToday } from '../../lib/format.js'
import { share, formatExpenseSummary } from '../../lib/share.js'
import ExpenseEditor from './ExpenseEditor.jsx'

export default function ExpensesScreen() {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const [range, setRange] = useState('month')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const now = new Date()
  const inRange = useMemo(() => {
    return expenses.items.filter(e => {
      const d = new Date(e.date)
      if (range === 'today') return isToday(e.date)
      if (range === 'week') { const w = new Date(); w.setDate(w.getDate() - 7); return d >= w }
      if (range === 'year') return d.getFullYear() === now.getFullYear()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  }, [expenses.items, range])

  const total = inRange.reduce((s, e) => s + (+e.amount || 0), 0)
  const byCat = {}
  inRange.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (+e.amount || 0) })
  const catBars = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([id, v]) => ({ label: label(findCategory(id), lang) || id, value: v }))

  const budget = Number(settings.monthlyBudget) || 0
  const budgetPct = budget ? Math.min(1, total / budget) : 0
  const recent = [...expenses.items].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30)

  return (
    <>
      <TopBar title={t('expenses')} right={
        <button className="iconbtn" onClick={() => share(formatExpenseSummary(inRange, lang, settings))} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        <div style={{ margin: '14px 0' }}>
          <Segmented value={range} onChange={setRange} options={[
            { value: 'today', label: t('today') },
            { value: 'week', label: t('thisWeek') },
            { value: 'month', label: t('monthlyTotal') },
            { value: 'year', label: t('thisYear') },
          ]} />
        </div>

        <Card style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {range === 'month' ? t('monthlyTotal') : range === 'today' ? t('todaysSpending') : range === 'week' ? t('thisWeek') : t('thisYear')}
          </div>
          <div style={{ fontSize: 38, fontWeight: 780, marginTop: 6, letterSpacing: '-0.03em' }} className="tnum">{money(total, cur, lang)}</div>
          {range === 'month' && budget > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="bar-track" style={{ height: 12 }}>
                <div className="bar-fill" style={{ width: `${budgetPct * 100}%`, background: budgetPct >= 1 ? 'var(--danger)' : budgetPct > 0.8 ? 'var(--warn)' : 'var(--ok)' }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {money(total, cur, lang)} {t('spent')} · {t('budget')} {money(budget, cur, lang)}
              </div>
            </div>
          )}
        </Card>

        <div className="stat-grid" style={{ marginTop: 14 }}>
          <Stat label={lang === 'ar' ? 'عدد العمليات' : 'Transactions'} value={inRange.length} />
          <Stat label={t('largest')} value={money(Math.max(0, ...inRange.map(e => +e.amount || 0)), cur, lang)} />
        </div>

        {catBars.length > 0 && (
          <>
            <Section title={t('spendingByCategory')} />
            <Card><Bars data={catBars} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        <Section title={t('recent')} count={expenses.items.length} />
        {recent.length === 0 ? (
          <Empty icon="wallet" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newExpense')}</Button>} />
        ) : recent.map(e => {
          const cat = findCategory(e.category)
          const pm = findPayment(e.method)
          return (
            <div className="li" key={e.id} onClick={() => setEditor(e)}>
              <div className="lead t-brand"><Icon name="receipt" size={18} /></div>
              <div className="body">
                <div className="title">{e.merchant || label(cat, lang)}</div>
                <div className="meta">{label(cat, lang)} · {fmtDate(e.date, lang, settings.dateFormat)}{pm ? ` · ${label(pm, lang)}` : ''}</div>
              </div>
              <b className="tnum">{money(e.amount, e.currency || cur, lang)}</b>
            </div>
          )
        })}
      </div>

      <Fab onClick={() => setEditor({})} />
      {editor && <ExpenseEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}
