import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Button, Bars, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore, useSettings } from '../../store/StoreProvider.jsx'
import { money, expenseSar, toSar, monthKey } from '../../lib/format.js'
import { catLabel } from '../../lib/domain.js'
import { netWorth } from '../../lib/networth.js'
import { printHtml } from '../../lib/exporters.js'

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

function inMonth(dateStr, y, m) {
  const d = new Date(dateStr)
  return !isNaN(d) && d.getFullYear() === y && d.getMonth() === m
}

// A polished, shareable monthly "Family CFO" summary: income, spending by
// category, cashflow and a net-worth snapshot — printable/saveable as PDF.
export default function MonthlyReportScreen({ go }) {
  const { t, lang } = useT()
  const { data } = useStore()
  const { settings } = useSettings()
  const rates = settings.rates
  const cur = settings.currency
  const toast = useToast()

  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const step = (delta) => setYm(prev => {
    const d = new Date(prev.y, prev.m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const report = useMemo(() => {
    const { y, m } = ym
    const expenses = (data.expenses || []).filter(e => inMonth(e.date, y, m))
    const income = (data.income || []).filter(i => inMonth(i.date, y, m))
    const incomeTotal = income.reduce((s, i) => s + toSar(i.amount, i.currency, rates), 0)
    const expenseTotal = expenses.reduce((s, e) => s + expenseSar(e, rates), 0)
    const byCat = {}
    expenses.forEach(e => { const k = e.category || 'other'; byCat[k] = (byCat[k] || 0) + expenseSar(e, rates) })
    const cats = Object.entries(byCat).map(([k, v]) => ({ id: k, label: catLabel(k, lang), value: Math.round(v) })).sort((a, b) => b.value - a.value)
    return { incomeTotal, expenseTotal, net: incomeTotal - expenseTotal, cats, count: expenses.length }
  }, [ym, data.expenses, data.income, rates, lang])

  const nw = useMemo(() => netWorth({
    accounts: data.accounts || [], investments: data.investments || [], properties: data.properties || [],
    valuables: data.valuables || [], income: data.income || [], expenses: data.expenses || [],
    liabilities: data.liabilities || [], rates,
  }), [data, rates])

  const monthLabel = `${MONTHS_EN[ym.m]} ${ym.y}`
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth()

  const sharePdf = () => {
    const row = (l, v, cls = '') => `<tr><td>${l}</td><td class="n ${cls}">${v}</td></tr>`
    const catRows = report.cats.map(c => row(c.label, money(c.value, cur, lang))).join('')
    const body = `
      <h1>${settings.name ? settings.name + ' — ' : ''}${t('monthlyReport')}</h1>
      <div class="sub">${monthLabel}</div>
      <div class="total ${report.net >= 0 ? '' : 'brand'}">${money(report.net, cur, lang)}</div>
      <div class="muted">${t('netCashflow')}</div>
      <h2>${t('summary')}</h2>
      <table>
        ${row(t('income'), money(report.incomeTotal, cur, lang))}
        ${row(t('expenses'), money(report.expenseTotal, cur, lang))}
        ${row('<b>' + t('netCashflow') + '</b>', '<b>' + money(report.net, cur, lang) + '</b>')}
      </table>
      <h2>${t('spendingByCategory')}</h2>
      <table><thead><tr><th>${t('category')}</th><th class="n">${cur}</th></tr></thead><tbody>${catRows || row('—', '0')}</tbody></table>
      <h2>${t('netWorth')}</h2>
      <table>
        ${row(t('totalAssets'), money(nw.assets, cur, lang))}
        ${row(t('liabilities'), money(nw.liabilities, cur, lang))}
        ${row('<b>' + t('netWorth') + '</b>', '<b class="brand">' + money(nw.value, cur, lang) + '</b>')}
      </table>`
    printHtml(`${t('monthlyReport')} · ${monthLabel}`, body)
    toast.show(t('preparingReport'))
  }

  const maxCat = report.cats[0]?.value || 1

  return (
    <>
      <DetailHeader title={t('monthlyReport')} onBack={() => go('more')} />
      <div className="screen">
        {/* Month switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <button className="iconbtn" onClick={() => step(-1)} aria-label="prev"><Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <div style={{ fontWeight: 750, fontSize: 16 }}>{monthLabel}</div>
          <button className="iconbtn" onClick={() => step(1)} aria-label="next" disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }}><Icon name="chevron" size={18} /></button>
        </div>

        <Card style={{ textAlign: 'center', marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('netCashflow')}</div>
          <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }} className={`tnum ${report.net >= 0 ? 't-ok' : 't-danger'}`}>{money(report.net, cur, lang)}</div>
        </Card>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('income')} value={money(report.incomeTotal, cur, lang)} onClick={() => go('income')} />
          <Stat label={t('expenses')} value={money(report.expenseTotal, cur, lang)} onClick={() => go('expenses')} />
        </div>

        {report.cats.length > 0 && (
          <>
            <Section title={t('spendingByCategory')} count={report.count} />
            <Card className="stack">
              {report.cats.slice(0, 10).map(c => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                    <span className="tnum muted">{money(c.value, cur, lang)}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(4, c.value / maxCat * 100)}%`, background: 'var(--brand-500, var(--brand-400))', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        <Section title={t('netWorth')} />
        <div className="stat-grid">
          <Stat label={t('totalAssets')} value={money(nw.assets, cur, lang)} onClick={() => go('networth')} />
          <Stat label={t('netWorth')} value={money(nw.value, cur, lang)} onClick={() => go('networth')} />
        </div>

        <div style={{ marginTop: 18 }}>
          <Button variant="primary" block icon="download" onClick={sharePdf}>{t('shareAsPdf')}</Button>
        </div>
        <p className="hint center" style={{ marginTop: 8 }}>{t('reportShareHint')}</p>
      </div>
      {toast.node}
    </>
  )
}
