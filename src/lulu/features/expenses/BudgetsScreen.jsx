import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Select, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { catLabel, categoryOptions } from '../../lib/domain.js'
import { money, isSameMonth, expenseSar } from '../../lib/format.js'

export default function BudgetsScreen({ go }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const toast = useToast()
  const [adding, setAdding] = useState('')

  const budgets = settings.categoryBudgets || {}
  const spendByCat = {}
  expenses.items.filter(e => isSameMonth(e.date)).forEach(e => {
    spendByCat[e.category] = (spendByCat[e.category] || 0) + expenseSar(e, settings.rates)
  })
  const ids = Array.from(new Set([...Object.keys(budgets), ...Object.keys(spendByCat)]))
    .filter(id => (Number(budgets[id]) || 0) > 0 || (spendByCat[id] || 0) > 0)
    .sort((a, b) => (spendByCat[b] || 0) - (spendByCat[a] || 0))

  const setBudget = (id, val) => {
    const next = { ...budgets }
    const n = parseFloat(val)
    if (!n || n <= 0) delete next[id]; else next[id] = n
    updateSettings({ categoryBudgets: next })
  }
  const addBudgetRow = (id) => {
    if (!id) return
    updateSettings({ categoryBudgets: { ...budgets, [id]: budgets[id] || 0.0001 } })
    setAdding('')
  }

  const notYet = categoryOptions(lang, settings.customCategories).filter(o => budgets[o.value] == null)

  return (
    <>
      <DetailHeader title={t('categoryBudgets')} onBack={() => go('expenses')} />
      <div className="screen">
        <Field label={t('setBudget')} hint={t('budgetsHint')}>
          <Select value={adding} onChange={e => addBudgetRow(e.target.value)}>
            <option value="">{t('setBudget')}…</option>
            {notYet.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>

        {ids.length === 0 ? (
          <Empty icon="chart" title={t('noBudgets')} text={t('budgetsHint')} />
        ) : ids.map(id => {
          const budget = Number(budgets[id]) || 0
          const spend = spendByCat[id] || 0
          const pct = budget ? Math.min(1, spend / budget) : 0
          const over = budget && spend > budget
          const near = budget && !over && spend >= budget * 0.85
          return (
            <Card key={id} className="tight" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontWeight: 650 }}>{catLabel(id, lang)}</div>
                <div style={{ width: 120 }}>
                  <Input type="number" inputMode="decimal" value={budget || ''} placeholder="0"
                    onChange={e => setBudget(id, e.target.value)} style={{ textAlign: 'end' }} />
                </div>
              </div>
              {budget > 0 && (
                <>
                  <div className="bar-track" style={{ height: 8, marginTop: 10 }}>
                    <div className="bar-fill" style={{ width: `${pct * 100}%`, background: over ? 'var(--danger)' : near ? 'var(--warn)' : 'var(--ok)' }} />
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{money(spend, cur, lang)} / {money(budget, cur, lang)}</span>
                    <span className={over ? 't-danger' : near ? 't-warn' : ''} style={over || near ? { padding: '1px 6px', borderRadius: 6, fontWeight: 700 } : undefined}>
                      {over ? t('overBudgetAlert') : near ? t('nearBudget') : `${money(budget - spend, cur, lang)} ${t('remaining')}`}
                    </span>
                  </div>
                </>
              )}
            </Card>
          )
        })}
      </div>
      {toast.node}
    </>
  )
}
