import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Stat, Bars } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, expenseSar, toSar } from '../../lib/format.js'
import { catLabel } from '../../lib/domain.js'
import { exportXlsx, printHtml } from '../../lib/exporters.js'

const N = 6 // months to show

export default function TrendsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const expenses = useCollection('expenses')
  const income = useCollection('income')

  const months = useMemo(() => {
    const out = []
    const now = new Date()
    for (let i = N - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const inMonth = (ds) => (ds || '').slice(0, 7) === key
      const exp = expenses.items.filter(e => inMonth(e.date)).reduce((s, e) => s + expenseSar(e, rates), 0)
      const inc = income.items.filter(x => inMonth(x.date)).reduce((s, x) => s + toSar(x.amount, x.currency || 'SAR', rates), 0)
      out.push({ key, label: d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { month: 'short' }), exp, inc, net: inc - exp })
    }
    return out
  }, [expenses.items, income.items, rates, lang])

  const totalInc = months.reduce((s, m) => s + m.inc, 0)
  const totalExp = months.reduce((s, m) => s + m.exp, 0)
  const avgExp = totalExp / N
  const savingsRate = totalInc > 0 ? Math.round((totalInc - totalExp) / totalInc * 100) : 0
  const maxVal = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)))

  // Top categories over the window.
  const byCat = {}
  const cutoff = months[0].key
  expenses.items.filter(e => (e.date || '').slice(0, 7) >= cutoff).forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, rates) })
  const catBars = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ label: catLabel(id, lang), value: v }))

  const doExcel = async () => {
    const aoa = [[t('trends')], [t('month'), t('income'), t('expenses'), t('netThisMonth')],
      ...months.map(m => [m.key, Math.round(m.inc), Math.round(m.exp), Math.round(m.net)])]
    try { await exportXlsx(`trends-${months[months.length - 1].key}.xlsx`, t('trends'), aoa, [12, 12, 12, 12]) } catch { /* ignore */ }
  }
  const doPdf = () => {
    const rows = months.map(m => `<tr><td>${m.label} ${m.key.slice(0, 4)}</td><td class="n">${money(m.inc, cur, lang)}</td><td class="n">${money(m.exp, cur, lang)}</td><td class="n">${money(m.net, cur, lang)}</td></tr>`).join('')
    printHtml(t('trends'), `<h1 class="brand">${t('trends')}</h1><div class="sub">${t('lastNMonths').replace('{n}', N)}</div>
      <table><thead><tr><th>${t('month')}</th><th class="n">${t('income')}</th><th class="n">${t('expenses')}</th><th class="n">${t('netThisMonth')}</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  return (
    <>
      <DetailHeader title={t('trends')} onBack={() => go('expenses')} right={
        <>
          <button className="iconbtn" onClick={doExcel} aria-label={t('exportExcel')}><Icon name="download" size={18} /></button>
          <button className="iconbtn" onClick={doPdf} aria-label={t('exportPdf')}><Icon name="doc" size={18} /></button>
        </>
      } />
      <div className="screen">
        <div className="stat-grid" style={{ marginTop: 14 }}>
          <Stat label={t('avgMonthlySpend')} value={money(avgExp, cur, lang)} />
          <Stat label={t('savingsRate')} value={`${savingsRate}%`} sub={t('lastNMonths').replace('{n}', N)} />
        </div>

        <Section title={t('incomeVsExpenses')} />
        <Card>
          <div className="stack" style={{ gap: 12 }}>
            {months.map(m => (
              <div key={m.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <b>{m.label}</b>
                  <span className={m.net >= 0 ? 't-ok' : 't-danger'}>{m.net >= 0 ? '+' : '−'}{money(Math.abs(m.net), cur, lang)}</span>
                </div>
                <div className="bar-track" style={{ height: 8, marginBottom: 4 }}><div className="bar-fill" style={{ width: `${m.inc / maxVal * 100}%`, background: 'var(--ok)' }} /></div>
                <div className="bar-track" style={{ height: 8 }}><div className="bar-fill" style={{ width: `${m.exp / maxVal * 100}%`, background: 'var(--danger)' }} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--ok)', marginInlineEnd: 5 }} />{t('income')}</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--danger)', marginInlineEnd: 5 }} />{t('expenses')}</span>
          </div>
        </Card>

        {catBars.length > 0 && (
          <>
            <Section title={t('topCategories')} />
            <Card><Bars data={catBars} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}
      </div>
    </>
  )
}
