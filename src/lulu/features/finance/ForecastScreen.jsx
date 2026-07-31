import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore, useSettings } from '../../store/StoreProvider.jsx'
import { buildForecast } from '../../lib/forecast.js'
import { money } from '../../lib/format.js'

// Where your money is headed: today's balance rolled forward 30/60/90 days.
export default function ForecastScreen({ go }) {
  const { t, lang } = useT()
  const { data } = useStore()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates

  const f = useMemo(() => buildForecast({
    accounts: data.accounts || [], income: data.income || [], expenses: data.expenses || [],
    subscriptions: data.subscriptions || [], liabilities: data.liabilities || [], rates,
  }), [data.accounts, data.income, data.expenses, data.subscriptions, data.liabilities, rates])

  const rows = [
    { label: t('recurringIncome'), value: f.monthlyIncome, sign: 1, go: 'income' },
    { label: t('loanPayments'), value: f.loanPayments, sign: -1, go: 'liabilities' },
    { label: t('subscriptions'), value: f.subs, sign: -1, go: 'subscriptions' },
    { label: t('installments'), value: f.installments, sign: -1, go: 'moneycal' },
    { label: t('avgMonthlySpend'), value: f.avgSpend, sign: -1, go: 'trends' },
  ]
  const min = Math.min(f.balance, ...f.projections.map(p => p.value))

  return (
    <>
      <DetailHeader title={t('cashflowForecast')} onBack={() => go('expenses')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('netMonthly')}</div>
          <div className={`tnum ${f.netMonthly >= 0 ? 't-ok' : 't-danger'}`} style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }}>
            {f.netMonthly >= 0 ? '+' : ''}{money(f.netMonthly, cur, lang)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('perMonthAfterBills')}</div>
        </Card>

        <Section title={t('projectedBalance')} />
        <Card tight>
          <ProjRow label={t('today')} value={f.balance} cur={cur} lang={lang} strong />
          {f.projections.map(p => (
            <ProjRow key={p.days} label={`+${p.days} ${t('days')}`} value={p.value} cur={cur} lang={lang} warn={p.value < 0} />
          ))}
        </Card>
        {min < 0 && (
          <Card tight style={{ marginTop: 10, borderColor: 'var(--danger)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 4 }}>
              <span className="lead t-danger" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10 }}><Icon name="clock" size={18} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('forecastWarn')}</span>
            </div>
          </Card>
        )}

        <Section title={t('monthlyRunRate')} />
        <Card tight>
          {rows.map(r => (
            <div className="li" key={r.label} onClick={() => go(r.go)}>
              <div className={`lead ${r.sign > 0 ? 't-ok' : 't-warn'}`}><Icon name={r.sign > 0 ? 'wallet' : 'refresh'} size={17} /></div>
              <div className="body"><div className="title">{r.label}</div></div>
              <b className={`tnum ${r.sign > 0 ? 't-ok' : ''}`}>{r.sign > 0 ? '+' : '−'}{money(r.value, cur, lang)}</b>
            </div>
          ))}
        </Card>
        <p className="hint center" style={{ marginTop: 10 }}>{t('forecastHint')}</p>
      </div>
    </>
  )
}

function ProjRow({ label, value, cur, lang, strong, warn }) {
  return (
    <div className="li">
      <div className="body"><div className="title" style={{ fontWeight: strong ? 750 : 600 }}>{label}</div></div>
      <b className={`tnum ${warn ? 't-danger' : strong ? '' : 't-ok'}`} style={{ fontSize: strong ? 17 : 15 }}>{money(value, cur, lang)}</b>
    </div>
  )
}
