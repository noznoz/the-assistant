import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { INVESTMENT_TYPES, findInvestmentType, label } from '../../lib/domain.js'
import { money, toSar } from '../../lib/format.js'

const HUES = { stocks: '#4C7DF0', fund: '#8E63E5', realestate: '#2FA37B', crypto: '#E0912B', savings: '#D6564F', business: '#5AA9C9', other: '#8A8A8A' }

// Investment allocation by type, with target vs actual and drift.
export default function AllocationScreen({ go }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const investments = useCollection('investments')
  const [editing, setEditing] = useState(false)

  const val = (v) => toSar(v.currentValue || v.invested, v.currency || 'SAR', rates)
  const total = investments.items.reduce((s, v) => s + val(v), 0)

  const byType = {}
  investments.items.forEach(v => { const k = v.type || 'other'; byType[k] = (byType[k] || 0) + val(v) })
  const rows = INVESTMENT_TYPES
    .map(tp => ({ id: tp.id, tp, value: byType[tp.id] || 0 }))
    .filter(r => r.value > 0 || (settings.targetAllocation || {})[r.id] > 0)
    .map(r => {
      const actual = total > 0 ? (r.value / total) * 100 : 0
      const target = Number((settings.targetAllocation || {})[r.id]) || 0
      return { ...r, actual, target, drift: actual - target }
    })
    .sort((a, b) => b.value - a.value)

  const targetSum = rows.reduce((s, r) => s + r.target, 0)
  const setTarget = (id, v) => updateSettings({ targetAllocation: { ...(settings.targetAllocation || {}), [id]: Math.max(0, Math.min(100, Number(v) || 0)) } })

  return (
    <>
      <DetailHeader title={t('allocation')} onBack={() => go('investments')} right={
        total > 0 ? <button className="iconbtn" onClick={() => setEditing(e => !e)} aria-label={t('editTargets')}><Icon name={editing ? 'check' : 'cog'} size={18} /></button> : null
      } />
      <div className="screen">
        {total === 0 ? (
          <Card style={{ marginTop: 14, textAlign: 'center' }}><p className="muted">{t('noInvestments')}</p></Card>
        ) : (
          <>
            <Card style={{ textAlign: 'center', marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('portfolioValue')}</div>
              <div style={{ fontSize: 30, fontWeight: 780, marginTop: 4 }} className="tnum">{money(total, cur, lang)}</div>
            </Card>

            {/* Stacked allocation bar */}
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginTop: 14, border: '1px solid var(--line)' }}>
              {rows.map(r => r.actual > 0 && (
                <div key={r.id} title={label(r.tp, lang)} style={{ width: `${r.actual}%`, background: HUES[r.id] || '#8A8A8A' }} />
              ))}
            </div>

            <Section title={t('byAssetType')} />
            <Card className="stack">
              {rows.map(r => (
                <div key={r.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: HUES[r.id] || '#8A8A8A', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, flex: 1 }}>{label(r.tp, lang)}</span>
                    <span className="tnum muted">{money(r.value, cur, lang)}</span>
                    <b className="tnum" style={{ width: 44, textAlign: 'end' }}>{Math.round(r.actual)}%</b>
                  </div>
                  {editing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px 18px' }}>
                      <span className="muted" style={{ fontSize: 12 }}>{t('target')}</span>
                      <input type="number" inputMode="numeric" className="input" style={{ width: 70, padding: '6px 8px' }}
                        value={(settings.targetAllocation || {})[r.id] ?? ''} onChange={e => setTarget(r.id, e.target.value)} placeholder="0" />
                      <span className="muted" style={{ fontSize: 12 }}>%</span>
                    </div>
                  ) : r.target > 0 && (
                    <div style={{ display: 'flex', gap: 8, margin: '4px 0 2px 18px', fontSize: 12 }}>
                      <span className="muted">{t('target')} {r.target}%</span>
                      <span className={Math.abs(r.drift) < 3 ? 't-ok' : r.drift > 0 ? 't-warn' : 't-info'} style={{ fontWeight: 650 }}>
                        {r.drift >= 0 ? '▲' : '▼'} {Math.abs(Math.round(r.drift))}% {r.drift >= 0 ? t('overweight') : t('underweight')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </Card>

            {editing && targetSum > 0 && (
              <p className={`hint center ${targetSum === 100 ? 't-ok' : 't-warn'}`} style={{ marginTop: 8, fontWeight: 600 }}>
                {t('targetsSum')}: {targetSum}%{targetSum !== 100 ? ` · ${t('shouldBe100')}` : ''}
              </p>
            )}
            {!editing && (
              <Button block icon="chart" style={{ marginTop: 14 }} onClick={() => go('investments')}>{t('investments')}</Button>
            )}
          </>
        )}
      </div>
    </>
  )
}
