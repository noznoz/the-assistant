import React, { useMemo, useEffect, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Stat, Bars, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money } from '../../lib/format.js'
import { netWorth, monthKey } from '../../lib/networth.js'
import { share } from '../../lib/share.js'

export default function NetWorthScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const accounts = useCollection('accounts')
  const investments = useCollection('investments')
  const income = useCollection('income')
  const expenses = useCollection('expenses')
  const snapshots = useCollection('networth')

  const nw = useMemo(() => netWorth({
    accounts: accounts.items, investments: investments.items,
    income: income.items, expenses: expenses.items, rates,
  }), [accounts.items, investments.items, income.items, expenses.items, rates])

  // Record (or update) this month's snapshot so a trend builds up over time.
  // A ref guards against StrictMode's double effect creating a duplicate.
  const wrote = useRef(false)
  useEffect(() => {
    const key = monthKey()
    const rounded = Math.round(nw.value)
    const existing = snapshots.items.find(s => s.month === key)
    if (existing) { if (Math.round(existing.value) !== rounded) snapshots.patch(existing.id, { value: rounded, assets: Math.round(nw.assets), liabilities: Math.round(nw.liabilities) }) }
    else if (!wrote.current) { wrote.current = true; snapshots.add({ month: key, value: rounded, assets: Math.round(nw.assets), liabilities: Math.round(nw.liabilities) }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nw.value])

  // De-dupe by month (keep the latest per month) so the trend is one point/month.
  const byMonth = {}
  snapshots.items.forEach(s => { byMonth[s.month] = s })
  const history = Object.values(byMonth).sort((a, b) => (a.month || '').localeCompare(b.month || '')).slice(-6)
  const trend = history.map(s => ({ label: s.month.slice(2), value: Math.max(0, s.value) }))
  const prev = history.length > 1 ? history[history.length - 2].value : null
  const change = prev != null ? nw.value - prev : null

  const composition = [
    { label: t('accounts'), value: Math.max(0, nw.accountsTotal) },
    { label: t('investments'), value: Math.max(0, nw.investTotal) },
  ].filter(x => x.value > 0)

  const shareStatement = () => {
    const L = lang === 'ar'
    share([
      L ? '💼 صافي الثروة' : '💼 Net Worth',
      `${L ? 'الأصول' : 'Assets'}: ${money(nw.assets, cur, lang)}`,
      `${L ? 'الخصوم' : 'Liabilities'}: ${money(nw.liabilities, cur, lang)}`,
      `${L ? 'الصافي' : 'Net worth'}: ${money(nw.value, cur, lang)}`,
    ].join('\n'))
  }

  return (
    <>
      <DetailHeader title={t('netWorth')} onBack={() => go('expenses')} right={
        <button className="iconbtn" onClick={shareStatement} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('netWorth')}</div>
          <div style={{ fontSize: 36, fontWeight: 780, marginTop: 4 }} className={`tnum ${nw.value >= 0 ? '' : 't-danger'}`}>{money(nw.value, cur, lang)}</div>
          {change != null && (
            <div className={`muted ${change >= 0 ? 't-ok' : 't-danger'}`} style={{ fontSize: 13, marginTop: 4, fontWeight: 650 }}>
              {change >= 0 ? '▲' : '▼'} {money(Math.abs(change), cur, lang)} {t('vsLastMonth')}
            </div>
          )}
        </Card>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('assets')} value={money(nw.assets, cur, lang)} onClick={() => go('accounts')} />
          <Stat label={t('liabilities')} value={money(nw.liabilities, cur, lang)} sub={t('installmentsOutstanding')} />
        </div>

        {composition.length > 0 && (
          <>
            <Section title={t('assetBreakdown')} />
            <Card><Bars data={composition} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        {trend.length > 1 && (
          <>
            <Section title={t('netWorthTrend')} />
            <Card><Bars data={trend} format={(v) => money(v, cur, lang)} /></Card>
            <p className="hint center" style={{ marginTop: 8 }}>{t('netWorthTrendHint')}</p>
          </>
        )}

        <div className="row2" style={{ marginTop: 16 }}>
          <Button icon="wallet" onClick={() => go('accounts')}>{t('accounts')}</Button>
          <Button icon="chart" onClick={() => go('investments')}>{t('investments')}</Button>
        </div>
      </div>
    </>
  )
}
