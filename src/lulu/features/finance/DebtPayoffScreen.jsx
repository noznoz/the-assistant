import React, { useMemo, useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Segmented, Empty, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, fmtDate } from '../../lib/format.js'
import { simulatePayoff, payoffDate } from '../../lib/debt.js'

// "When am I debt-free?" — avalanche vs snowball with optional extra payment.
export default function DebtPayoffScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const liabilities = useCollection('liabilities')
  const [strategy, setStrategy] = useState('avalanche')
  const [extra, setExtra] = useState(0)

  const loans = liabilities.items.filter(l => (Number(l.balance) || 0) > 0)
  const totalDebt = loans.reduce((s, l) => s + (Number(l.balance) || 0), 0)
  const totalMin = loans.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)

  const plan = useMemo(() => simulatePayoff(loans, strategy, extra), [liabilities.items, strategy, extra])
  const baseline = useMemo(() => simulatePayoff(loans, strategy, 0), [liabilities.items, strategy])
  const saved = (baseline.months != null && plan.months != null) ? baseline.months - plan.months : 0
  const savedInterest = baseline.totalInterest - plan.totalInterest
  const date = payoffDate(plan.months)

  const EXTRAS = [0, 1000, 2500, 5000, 10000]

  return (
    <>
      <DetailHeader title={t('debtPayoff')} onBack={() => go('liabilities')} />
      <div className="screen">
        {loans.length === 0 ? (
          <Empty icon="wallet" title={t('noDebt')} text={t('noDebtHint')}
            action={<Button variant="primary" icon="plus" onClick={() => go('liabilities')}>{t('liabilities')}</Button>} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <Stat label={t('totalDebt')} value={money(totalDebt, cur, lang)} onClick={() => go('liabilities')} />
              <Stat label={t('monthlyPayments')} value={money(totalMin, cur, lang)} />
            </div>

            <Section title={t('strategy')} />
            <Segmented value={strategy} onChange={setStrategy} options={[
              { value: 'avalanche', label: t('avalanche') },
              { value: 'snowball', label: t('snowball') },
            ]} />
            <p className="hint" style={{ margin: '8px 2px 0' }}>{strategy === 'avalanche' ? t('avalancheHint') : t('snowballHint')}</p>

            <Section title={t('extraPerMonth')} />
            <div className="chip-row">
              {EXTRAS.map(x => (
                <button key={x} className={`chip ${extra === x ? 'on' : ''}`} onClick={() => setExtra(x)}
                  style={extra === x ? { background: 'var(--brand-500, var(--brand-400))', color: '#fff' } : {}}>
                  {x === 0 ? t('none') : '+' + money(x, cur, lang)}
                </button>
              ))}
            </div>

            <Card style={{ textAlign: 'center', marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('debtFreeBy')}</div>
              {plan.feasible ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 780, marginTop: 4 }}>{fmtDate(date, lang, settings.dateFormat)}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{plan.months} {t('months')}{saved > 0 ? ` · ${saved} ${t('monthsSooner')}` : ''}</div>
                </>
              ) : (
                <div className="t-danger" style={{ fontWeight: 700, marginTop: 6 }}>{t('debtNotFeasible')}</div>
              )}
            </Card>

            <div className="stat-grid" style={{ marginTop: 12 }}>
              <Stat label={t('totalInterest')} value={money(plan.totalInterest, cur, lang)} />
              <Stat label={t('interestSaved')} value={savedInterest > 1 ? money(savedInterest, cur, lang) : '—'} />
            </div>

            {plan.order.some(o => o.paidMonth != null) && (
              <>
                <Section title={t('payoffOrder')} />
                <Card tight>
                  {plan.order.map((o, i) => (
                    <div className="li" key={o.name + i}>
                      <div className="lead t-brand" style={{ fontWeight: 750 }}>{i + 1}</div>
                      <div className="body"><div className="title">{o.name}</div></div>
                      {o.paidMonth != null && <span className="chip t-ok">{fmtDate(payoffDate(o.paidMonth), lang, settings.dateFormat)}</span>}
                    </div>
                  ))}
                </Card>
              </>
            )}
            <p className="hint center" style={{ marginTop: 12 }}>{t('debtHint')}</p>
          </>
        )}
      </div>
    </>
  )
}
