import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Card, Section, Stat, Segmented, Bars, Fab, Empty, Button, Sheet, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings, undoLastDelete } from '../../store/StoreProvider.jsx'
import { findPayment, catLabel, label } from '../../lib/domain.js'
import { money, fmtDate, isToday, isSameMonth, expenseSar, toSar } from '../../lib/format.js'
import { isIncluded } from '../../lib/accounts.js'
import { share, formatExpenseSummary } from '../../lib/share.js'
import ExpenseEditor from './ExpenseEditor.jsx'
import MoneyReviewSheet from './MoneyReviewSheet.jsx'
import { buildMoneyReview } from '../../lib/moneyReview.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

// Everything else in Money, one tap away in a sheet instead of crowding the page.
const MONEY_GROUPS = [
  { key: 'finOverview', items: [
    { id: 'income', icon: 'wallet', tint: 't-ok' }, { id: 'accounts', icon: 'wallet' },
    { id: 'networth', icon: 'shield', label: 'netWorth' }, { id: 'trends', icon: 'chart' }, { id: 'statement', icon: 'doc', label: 'monthlyStatement' },
  ] },
  { key: 'finPlan', items: [
    { id: 'budgets', icon: 'chart' }, { id: 'goals', icon: 'sparkle', label: 'savingsGoals' }, { id: 'forecast', icon: 'chart', label: 'cashflowForecast' },
    { id: 'moneycal', icon: 'calendar', label: 'moneyCalendar' }, { id: 'zakat', icon: 'sparkle' },
  ] },
  { key: 'finGrow', items: [
    { id: 'investments', icon: 'chart' }, { id: 'properties', icon: 'doc' },
    { id: 'liabilities', icon: 'wallet' }, { id: 'debtpayoff', icon: 'chart', label: 'debtPayoff' },
  ] },
  { key: 'finTrack', items: [
    { id: 'subscriptions', icon: 'refresh' }, { id: 'projects', icon: 'report' },
  ] },
]

export default function ExpensesScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const projects = useCollection('projects')
  const income = useCollection('income')
  const accounts = useCollection('accounts')
  const [range, setRange] = useState('month')
  const [editor, setEditor] = useState(null)
  const [review, setReview] = useState(null)
  const [hub, setHub] = useState(false)          // "More in Money" sheet
  const [details, setDetails] = useState(false)  // spending details expanded
  const [allRecent, setAllRecent] = useState(false)
  const toast = useToast()
  const openReview = () => setReview(buildMoneyReview({ expenses: expenses.items, settings, lang }).text)

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

  const byCat = {}
  inRange.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, rates) })
  const catBars = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([id, v]) => ({ label: catLabel(id, lang), value: v }))

  const byAccount = {}
  inRange.forEach(e => { const a = e.account || t('unassignedAccount'); byAccount[a] = (byAccount[a] || 0) + expenseSar(e, rates) })
  const acctBars = Object.entries(byAccount).sort((a, b) => b[1] - a[1]).map(([lbl, v]) => ({ label: lbl, value: v }))

  const byMerchant = {}
  inRange.forEach(e => { const m = (e.merchant || '').trim(); if (m) byMerchant[m] = (byMerchant[m] || 0) + expenseSar(e, rates) })
  const merchantBars = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([lbl, v]) => ({ label: lbl, value: v }))

  const budget = Number(settings.monthlyBudget) || 0
  const recent = [...expenses.items].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30)

  // Over-budget category alerts (current month, regardless of the range filter).
  const catBudgets = settings.categoryBudgets || {}
  const monthByCat = {}
  expenses.items.filter(e => isSameMonth(e.date)).forEach(e => { monthByCat[e.category] = (monthByCat[e.category] || 0) + expenseSar(e, rates) })
  const overBudgetCats = Object.keys(catBudgets).filter(id => (Number(catBudgets[id]) || 0) > 0 && (monthByCat[id] || 0) > catBudgets[id])

  const monthCatBars = Object.entries(monthByCat).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, v]) => ({ label: catLabel(id, lang), value: v }))
  const monthBudgetPct = budget ? Math.min(1, monthExpTotal / budget) : 0
  const left = budget - monthExpTotal

  return (
    <>
      <TopBar title={t('myFinance')} right={
        <>
          <button className="iconbtn" onClick={() => go('expensereport')} aria-label={t('expenseReport')}><Icon name="chart" size={18} /></button>
          <button className="iconbtn" onClick={() => share(formatExpenseSummary(inRange, lang, settings))} aria-label={t('share')}><Icon name="share" size={18} /></button>
        </>
      } />
      <div className="screen">
        {/* One calm summary: what this month cost, against the budget. */}
        <Card className="money-hero" style={{ marginTop: 14 }}>
          <div className="mh-label">{t('spentThisMonth')}</div>
          <div className="mh-amount tnum">{money(monthExpTotal, cur, lang)}</div>
          {budget > 0 ? (
            <>
              <div className="bar-track" style={{ height: 10, marginTop: 12 }} role="progressbar"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(monthBudgetPct * 100)} aria-label={t('budget')}>
                <div className="bar-fill" style={{ width: `${monthBudgetPct * 100}%`, background: monthBudgetPct >= 1 ? 'var(--danger)' : monthBudgetPct > 0.8 ? 'var(--warn)' : 'var(--ok)' }} />
              </div>
              <div className={`mh-sub${left < 0 ? ' t-danger' : ''}`}>
                {left >= 0
                  ? <><b className="tnum">{money(left, cur, lang)}</b> {t('leftOfBudget')} <span className="tnum">{money(budget, cur, lang)}</span></>
                  : <><b className="tnum">{money(-left, cur, lang)}</b> {t('overBudgetBy')}</>}
              </div>
            </>
          ) : (
            <button className="link-btn mh-sub" onClick={() => go('settings')}>{t('noBudgetHint')}</button>
          )}
          {specialExp > 0 && (
            <div className="mh-sub">{t('expMonthly')} <span className="tnum">{money(monthlyExp, cur, lang)}</span> · {t('expSpecial')} <span className="tnum">{money(specialExp, cur, lang)}</span></div>
          )}
          <div className="mh-split">
            <button className="mh-cell" onClick={() => go('income')}>
              <span>{t('income')}</span>
              <b className="tnum t-ok">{money(monthIncome, cur, lang)}</b>
            </button>
            <button className="mh-cell" onClick={() => go('networth')}>
              <span>{t('netLbl')}</span>
              <b className={`tnum ${net >= 0 ? 't-ok' : 't-danger'}`}>{net >= 0 ? '' : '−'}{money(Math.abs(net), cur, lang)}</b>
            </button>
          </div>
        </Card>

        {overBudgetCats.length > 0 && (
          <Card className="tight" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, borderColor: 'var(--danger-tint)' }} onClick={() => go('budgets')}>
            <span className="lead t-danger" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="flag" size={18} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{overBudgetCats.length} {t('overBudgetAlert')}</div>
              <div className="muted" style={{ fontSize: 15 }}>{overBudgetCats.map(c => catLabel(c, lang)).slice(0, 3).join(' · ')}</div>
            </div>
            <Icon name="chevron" size={18} style={{ color: 'var(--ink-3)' }} />
          </Card>
        )}

        <div className="act-row">
          <button className="act" onClick={openReview}><Icon name="sparkle" size={20} />{t('monthlyReview')}</button>
          <button className="act" onClick={() => setHub(true)} aria-haspopup="dialog"><Icon name="grid" size={20} />{t('moreInMoney')}</button>
          <button className="act" onClick={() => go('budgets')}><Icon name="chart" size={20} />{t('budgets')}</button>
        </div>

        {monthCatBars.length > 0 && (
          <>
            <Section title={t('spendingByCategory')} />
            <Card><Bars data={monthCatBars} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        <button className="link-btn plan-more" aria-expanded={details} onClick={() => setDetails(!details)}>
          {t('spendingDetails')} <Icon name="chevron" size={14} style={{ transform: details ? 'rotate(90deg)' : 'none', verticalAlign: 'middle' }} />
        </button>
        {details && (
          <div className="money-details">
            <Segmented value={range} onChange={setRange} options={[
              { value: 'today', label: t('today') },
              { value: 'week', label: t('thisWeek') },
              { value: 'month', label: t('monthlyTotal') },
              { value: 'year', label: t('thisYear') },
            ]} />
            <div className="stat-grid" style={{ marginTop: 12 }}>
              <Stat label={range === 'month' ? t('monthlyTotal') : range === 'today' ? t('todaysSpending') : range === 'week' ? t('thisWeek') : t('thisYear')} value={money(total, cur, lang)} />
              <Stat label={lang === 'ar' ? 'عدد العمليات' : 'Transactions'} value={inRange.length} />
              <Stat label={t('largest')} value={money(Math.max(0, ...inRange.map(e => expenseSar(e, rates))), cur, lang)} />
            </div>
            {range !== 'month' && catBars.length > 0 && (
              <>
                <Section title={t('spendingByCategory')} />
                <Card><Bars data={catBars} format={(v) => money(v, cur, lang)} /></Card>
              </>
            )}
            {merchantBars.length > 0 && (
              <>
                <Section title={t('topMerchants')} />
                <Card><Bars data={merchantBars} format={(v) => money(v, cur, lang)} /></Card>
              </>
            )}
            {acctBars.length > 1 && (
              <>
                <Section title={t('spendingByAccount')} />
                <Card><Bars data={acctBars} format={(v) => money(v, cur, lang)} /></Card>
              </>
            )}
          </div>
        )}

        <Section title={t('recent')} count={expenses.items.length} />
        {recent.length === 0 ? (
          <Empty icon="wallet" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newExpense')}</Button>} />
        ) : recent.slice(0, allRecent ? recent.length : 8).map(e => {
          const pm = findPayment(e.method)
          const proj = e.projectId && projects.items.find(p => p.id === e.projectId)
          return (
            <SwipeRow key={e.id} onEdit={() => setEditor(e)} onDelete={() => { expenses.remove(e.id); toast.show(t('deletedToast'), [{ label: t('undo'), onClick: undoLastDelete }]) }}>
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
                {(e.currency && e.currency !== 'SAR') && <div className="muted tnum" style={{ fontSize: 13 }}>≈ {money(expenseSar(e, rates), 'SAR', lang)}</div>}
              </div>
            </div>
            </SwipeRow>
          )
        })}
        {recent.length > 8 && (
          <button className="link-btn plan-more" onClick={() => setAllRecent(!allRecent)}>
            {allRecent ? t('showLess') : `${t('showAll')} (${recent.length})`}
          </button>
        )}
      </div>

      <Fab onClick={() => setEditor({})} />
      {editor && <ExpenseEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {hub && (
        <Sheet title={t('moreInMoney')} onClose={() => setHub(false)}>
          {MONEY_GROUPS.map(grp => (
            <React.Fragment key={grp.key}>
              <Section title={t(grp.key)} />
              <div className="qa-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
                {grp.items.map(it => (
                  <button key={it.id} className="qa" onClick={() => { setHub(false); go(it.id) }}>
                    <span className={`ic ${it.tint || ''}`}><Icon name={it.icon} size={22} /></span>{t(it.label || it.id)}
                  </button>
                ))}
              </div>
            </React.Fragment>
          ))}
        </Sheet>
      )}
      {review && <MoneyReviewSheet review={review} onClose={() => setReview(null)} />}
      {toast.node}
    </>
  )
}
