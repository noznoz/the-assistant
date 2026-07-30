import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Stat, Bars, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, toSar, expenseSar } from '../../lib/format.js'
import { catLabel, findIncomeSource, label } from '../../lib/domain.js'
import { exportXlsx, printHtml } from '../../lib/exporters.js'
import { share } from '../../lib/share.js'

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key, lang) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' })
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

export default function StatementScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const expenses = useCollection('expenses')
  const income = useCollection('income')
  const now = new Date()
  const [key, setKey] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  const S = useMemo(() => {
    const inM = (ds) => (ds || '').slice(0, 7) === key
    const exps = expenses.items.filter(e => inM(e.date))
    const incs = income.items.filter(i => inM(i.date))
    const expTotal = exps.reduce((s, e) => s + expenseSar(e, rates), 0)
    const incTotal = incs.reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)
    const byCat = {}; exps.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, rates) })
    const byMerchant = {}; exps.forEach(e => { const m = e.merchant || e.item || catLabel(e.category, lang); byMerchant[m] = (byMerchant[m] || 0) + expenseSar(e, rates) })
    const bySource = {}; incs.forEach(i => { bySource[i.source] = (bySource[i.source] || 0) + toSar(i.amount, i.currency || 'SAR', rates) })
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    return {
      exps, incs, expTotal, incTotal, net: incTotal - expTotal,
      cats,
      catBars: cats.slice(0, 8).map(([id, v]) => ({ label: catLabel(id, lang), value: v })),
      merchants: Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 6),
      sources: Object.entries(bySource).sort((a, b) => b[1] - a[1]),
    }
  }, [expenses.items, income.items, key, rates, lang])

  const doExcel = async () => {
    const aoa = [[t('monthlyStatement'), monthLabel(key, lang)], [],
      [t('income'), Math.round(S.incTotal)], [t('expenses'), Math.round(S.expTotal)], [t('netThisMonth'), Math.round(S.net)], [],
      [t('spendingByCategory'), 'SAR'], ...S.cats.map(([id, v]) => [catLabel(id, lang), Math.round(v)])]
    try { await exportXlsx(`statement-${key}.xlsx`, key, aoa, [22, 14]) } catch { /* ignore */ }
  }
  const doPdf = () => {
    const catRows = S.cats.map(([id, v]) => `<tr><td>${esc(catLabel(id, lang))}</td><td class="n">${money(v, cur, lang)}</td></tr>`).join('')
    const merchRows = S.merchants.map(([m, v]) => `<tr><td>${esc(m)}</td><td class="n">${money(v, cur, lang)}</td></tr>`).join('')
    printHtml(t('monthlyStatement'), `
      <h1 class="brand">${t('monthlyStatement')}</h1><div class="sub">${esc(monthLabel(key, lang))}</div>
      <div class="total">${money(S.net, cur, lang)}</div>
      <div class="muted">${t('income')}: ${money(S.incTotal, cur, lang)} · ${t('expenses')}: ${money(S.expTotal, cur, lang)}</div>
      <h2>${t('spendingByCategory')}</h2><table><thead><tr><th>${t('category')}</th><th class="n">${t('amount')}</th></tr></thead><tbody>${catRows}</tbody></table>
      <h2>${t('topMerchants')}</h2><table><thead><tr><th>${t('merchant')}</th><th class="n">${t('amount')}</th></tr></thead><tbody>${merchRows}</tbody></table>`)
  }
  const doShare = () => {
    const L = lang === 'ar'
    share([
      `📊 ${t('monthlyStatement')} · ${monthLabel(key, lang)}`,
      `${t('income')}: ${money(S.incTotal, cur, lang)}`,
      `${t('expenses')}: ${money(S.expTotal, cur, lang)}`,
      `${L ? 'الصافي' : 'Net'}: ${money(S.net, cur, lang)}`,
      '', ...S.cats.slice(0, 5).map(([id, v]) => `• ${catLabel(id, lang)}: ${money(v, cur, lang)}`),
    ].join('\n'))
  }

  return (
    <>
      <DetailHeader title={t('monthlyStatement')} onBack={() => go('expenses')} right={
        <>
          <button className="iconbtn" onClick={doExcel} aria-label={t('exportExcel')}><Icon name="download" size={18} /></button>
          <button className="iconbtn" onClick={doPdf} aria-label={t('exportPdf')}><Icon name="doc" size={18} /></button>
        </>
      } />
      <div className="screen">
        {/* Month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0' }}>
          <button className="iconbtn" onClick={() => setKey(shiftMonth(key, -1))} aria-label="prev"><Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <b style={{ fontSize: 16 }}>{monthLabel(key, lang)}</b>
          <button className="iconbtn" onClick={() => setKey(shiftMonth(key, 1))} aria-label="next" disabled={key >= `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}><Icon name="chevron" size={18} /></button>
        </div>

        <Card style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('netThisMonth')}</div>
          <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }} className={`tnum ${S.net >= 0 ? 't-ok' : 't-danger'}`}>{S.net >= 0 ? '' : '−'}{money(Math.abs(S.net), cur, lang)}</div>
        </Card>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('income')} value={money(S.incTotal, cur, lang)} />
          <Stat label={t('expenses')} value={money(S.expTotal, cur, lang)} />
        </div>

        {S.catBars.length > 0 ? (
          <>
            <Section title={t('spendingByCategory')} />
            <Card><Bars data={S.catBars} format={(v) => money(v, cur, lang)} /></Card>

            {S.merchants.length > 0 && (
              <>
                <Section title={t('topMerchants')} />
                <Card tight>
                  {S.merchants.map(([m, v]) => (
                    <div key={m} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 4px', borderTop: '1px solid var(--line)' }}>
                      <span>{m}</span><b className="tnum">{money(v, cur, lang)}</b>
                    </div>
                  ))}
                </Card>
              </>
            )}

            {S.sources.length > 0 && (
              <>
                <Section title={t('income')} />
                <Card tight>
                  {S.sources.map(([s, v]) => {
                    const src = findIncomeSource(s)
                    return <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 4px', borderTop: '1px solid var(--line)' }}>
                      <span>{src ? label(src, lang) : s}</span><b className="tnum t-ok">{money(v, cur, lang)}</b>
                    </div>
                  })}
                </Card>
              </>
            )}

            <Button block variant="brand" icon="whatsapp" style={{ marginTop: 16 }} onClick={doShare}>{t('shareStatement')}</Button>
          </>
        ) : (
          <p className="center muted" style={{ marginTop: 30 }}>{t('noThingsToday')}</p>
        )}
      </div>
    </>
  )
}
