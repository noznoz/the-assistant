import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Card, Section, Stat, Segmented, Bars, Fab, Empty, Button, Sheet, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { findPayment, catLabel, label } from '../../lib/domain.js'
import { money, fmtDate, isToday, isSameMonth, expenseSar, toSar } from '../../lib/format.js'
import { isIncluded } from '../../lib/accounts.js'
import { share, formatExpenseSummary } from '../../lib/share.js'
import ExpenseEditor from './ExpenseEditor.jsx'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function ExpensesScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const projects = useCollection('projects')
  const income = useCollection('income')
  const investments = useCollection('investments')
  const accounts = useCollection('accounts')
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

  const rates = settings.rates
  const total = inRange.reduce((s, e) => s + expenseSar(e, rates), 0)

  // Finance overview — this month, in SAR: income, expenses (monthly vs special), net.
  // Net only counts accounts flagged "include in net" (untagged items count too).
  const acc = accounts.items
  const monthExp = expenses.items.filter(e => isSameMonth(e.date))
  const monthlyExp = monthExp.filter(e => (e.kind || 'monthly') !== 'special').reduce((s, e) => s + expenseSar(e, rates), 0)
  const specialExp = monthExp.filter(e => e.kind === 'special').reduce((s, e) => s + expenseSar(e, rates), 0)
  const monthExpTotal = monthlyExp + specialExp
  const monthIncome = income.items.filter(i => isSameMonth(i.date)).reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)
  const netIncome = income.items.filter(i => isSameMonth(i.date) && isIncluded(i.account, acc)).reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)
  const netExp = monthExp.filter(e => isIncluded(e.account, acc)).reduce((s, e) => s + expenseSar(e, rates), 0)
  const net = netIncome - netExp
  const portfolio = investments.items.reduce((s, v) => s + toSar(v.currentValue || v.invested, v.currency || 'SAR', rates), 0)

  const byCat = {}
  inRange.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, rates) })
  const catBars = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([id, v]) => ({ label: catLabel(id, lang), value: v }))

  const byAccount = {}
  inRange.forEach(e => { const a = e.account || t('unassignedAccount'); byAccount[a] = (byAccount[a] || 0) + expenseSar(e, rates) })
  const acctBars = Object.entries(byAccount).sort((a, b) => b[1] - a[1]).map(([lbl, v]) => ({ label: lbl, value: v }))

  const budget = Number(settings.monthlyBudget) || 0
  const budgetPct = budget ? Math.min(1, total / budget) : 0
  const recent = [...expenses.items].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30)

  // Over-budget category alerts (current month, regardless of the range filter).
  const catBudgets = settings.categoryBudgets || {}
  const monthByCat = {}
  expenses.items.filter(e => isSameMonth(e.date)).forEach(e => { monthByCat[e.category] = (monthByCat[e.category] || 0) + expenseSar(e, rates) })
  const overBudgetCats = Object.keys(catBudgets).filter(id => (Number(catBudgets[id]) || 0) > 0 && (monthByCat[id] || 0) > catBudgets[id])

  return (
    <>
      <TopBar title={t('myFinance')} right={
        <>
          <button className="iconbtn" onClick={() => go('expensereport')} aria-label={t('expenseReport')}><Icon name="chart" size={18} /></button>
          <button className="iconbtn" onClick={() => share(formatExpenseSummary(inRange, lang, settings))} aria-label={t('share')}><Icon name="share" size={18} /></button>
        </>
      } />
      <div className="screen">
        {/* Finance overview — this month */}
        <Card style={{ marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>{t('netThisMonth')}</div>
          <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4, textAlign: 'center' }} className={`tnum ${net >= 0 ? 't-ok' : 't-danger'}`}>
            {net >= 0 ? '' : '−'}{money(Math.abs(net), cur, lang)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <button className="qa" style={{ alignItems: 'flex-start', textAlign: 'start' }} onClick={() => go('income')}>
              <span className="muted" style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>{t('income')}</span>
              <b className="tnum t-ok" style={{ fontSize: 18 }}>{money(monthIncome, cur, lang)}</b>
            </button>
            <div className="qa" style={{ alignItems: 'flex-start', textAlign: 'start', cursor: 'default' }}>
              <span className="muted" style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>{t('expenses')}</span>
              <b className="tnum" style={{ fontSize: 18 }}>{money(monthExpTotal, cur, lang)}</b>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <span className="chip" style={{ flex: 1, justifyContent: 'space-between' }}>{t('expMonthly')} <b className="tnum">{money(monthlyExp, cur, lang)}</b></span>
            <span className="chip" style={{ flex: 1, justifyContent: 'space-between' }}>{t('expSpecial')} <b className="tnum">{money(specialExp, cur, lang)}</b></span>
          </div>
        </Card>

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
          <Stat label={t('largest')} value={money(Math.max(0, ...inRange.map(e => expenseSar(e, rates))), cur, lang)} />
        </div>

        {/* Quick access */}
        <div className="qa-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
          <button className="qa" onClick={() => go('income')}>
            <span className="ic t-ok"><Icon name="wallet" size={22} /></span>{t('income')}
          </button>
          <button className="qa" onClick={() => go('accounts')}>
            <span className="ic"><Icon name="wallet" size={22} /></span>{t('accounts')}
          </button>
          <button className="qa" onClick={() => go('investments')}>
            <span className="ic"><Icon name="chart" size={22} /></span>{t('investments')}
          </button>
          <button className="qa" onClick={() => go('subscriptions')}>
            <span className="ic"><Icon name="refresh" size={22} /></span>{t('subscriptions')}
          </button>
          <button className="qa" onClick={() => go('networth')}>
            <span className="ic"><Icon name="shield" size={22} /></span>{t('netWorth')}
          </button>
          <button className="qa" onClick={() => go('liabilities')}>
            <span className="ic"><Icon name="wallet" size={22} /></span>{t('liabilities')}
          </button>
          <button className="qa" onClick={() => go('moneycal')}>
            <span className="ic"><Icon name="calendar" size={22} /></span>{t('moneyCalendar')}
          </button>
          <button className="qa" onClick={() => go('trends')}>
            <span className="ic"><Icon name="chart" size={22} /></span>{t('trends')}
          </button>
          <button className="qa" onClick={() => go('statement')}>
            <span className="ic"><Icon name="doc" size={22} /></span>{t('monthlyStatement')}
          </button>
          <button className="qa" onClick={() => go('zakat')}>
            <span className="ic"><Icon name="sparkle" size={22} /></span>{t('zakat')}
          </button>
          <button className="qa" onClick={() => go('projects')}>
            <span className="ic"><Icon name="report" size={22} /></span>{t('projects')}
          </button>
          <button className="qa" onClick={() => go('budgets')}>
            <span className="ic"><Icon name="chart" size={22} /></span>{t('budgets')}
          </button>
        </div>

        {overBudgetCats.length > 0 && (
          <Card className="tight" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, borderColor: 'var(--danger-tint)' }} onClick={() => go('budgets')}>
            <span className="lead t-danger" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="flag" size={18} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{overBudgetCats.length} {t('overBudgetAlert')}</div>
              <div className="muted" style={{ fontSize: 13 }}>{overBudgetCats.map(c => catLabel(c, lang)).slice(0, 3).join(' · ')}</div>
            </div>
            <Icon name="chevron" size={18} style={{ color: 'var(--ink-3)' }} />
          </Card>
        )}

        {catBars.length > 0 && (
          <>
            <Section title={t('spendingByCategory')} />
            <Card><Bars data={catBars} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        {acctBars.length > 1 && (
          <>
            <Section title={t('spendingByAccount')} />
            <Card><Bars data={acctBars} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        <Section title={t('recent')} count={expenses.items.length} />
        {recent.length === 0 ? (
          <Empty icon="wallet" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newExpense')}</Button>} />
        ) : recent.map(e => {
          const pm = findPayment(e.method)
          const proj = e.projectId && projects.items.find(p => p.id === e.projectId)
          return (
            <SwipeRow key={e.id} onEdit={() => setEditor(e)} onDelete={() => { expenses.remove(e.id); toast.show(t('deletedToast')) }}>
            <div className="li" onClick={() => setEditor(e)}>
              <div className="lead t-brand"><Icon name="receipt" size={18} /></div>
              <div className="body">
                <div className="title">{e.item || e.merchant || catLabel(e.category, lang)}</div>
                <div className="meta">
                  {[e.item && e.merchant, catLabel(e.category, lang), fmtDate(e.date, lang, settings.dateFormat)].filter(Boolean).join(' · ')}
                  {e.method === 'installment' && Number(e.installmentMonths) > 0 && (
                    <span className="chip t-info" style={{ padding: '1px 7px' }}><Icon name="refresh" size={11} /> {t('installment')} {money(expenseSar(e, rates) / Number(e.installmentMonths), cur, lang)}×{Number(e.installmentMonths)}</span>
                  )}
                  {(e.receipts || []).length > 0 && <span className="chip" style={{ padding: '1px 7px' }}><Icon name="receipt" size={11} /></span>}
                  {e.account && <span className="chip" style={{ padding: '1px 7px' }}>{e.account}</span>}
                  {proj && <span className="chip t-brand" style={{ padding: '1px 7px' }}>{proj.name}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <b className="tnum">{money(e.amount, e.currency || cur, lang)}</b>
                {(e.currency && e.currency !== 'SAR') && <div className="muted tnum" style={{ fontSize: 11 }}>≈ {money(expenseSar(e, rates), 'SAR', lang)}</div>}
              </div>
            </div>
            </SwipeRow>
          )
        })}
      </div>

      <Fab onClick={() => setEditor({})} />
      {editor && <ExpenseEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}
