import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, TextArea, Select, Button, Chip, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, toSar, fmtDate, relativeDay } from '../../lib/format.js'
import { goalStats } from '../../lib/goals.js'
import { GROUP_ICONS } from '../../lib/domain.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

export default function GoalsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const goals = useCollection('goals')
  const [editor, setEditor] = useState(null)
  const [funds, setFunds] = useState(null)
  const toast = useToast()

  const active = goals.items.filter(g => { const s = goalStats(g); return !s.done })
  const savedTotal = goals.items.reduce((s, g) => s + toSar(g.saved || 0, g.currency || cur, rates), 0)
  const targetTotal = goals.items.reduce((s, g) => s + toSar(g.target || 0, g.currency || cur, rates), 0)

  return (
    <>
      <DetailHeader title={t('savingsGoals')} onBack={() => go('expenses')} />
      <div className="screen">
        {goals.items.length === 0 ? (
          <Empty icon="sparkle" title={t('noGoals')} text={t('goalsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addGoal')}</Button>} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <Stat label={t('savedSoFar')} value={money(savedTotal, cur, lang)} />
              <Stat label={t('goalTotal')} value={money(targetTotal, cur, lang)} />
            </div>

            <div style={{ marginTop: 14 }}>
              {goals.items.map(g => {
                const s = goalStats(g)
                return (
                  <SwipeRow key={g.id} onEdit={() => setEditor(g)} onDelete={() => { goals.remove(g.id); toast.show(t('deletedToast')) }}>
                    <Card style={{ marginBottom: 10 }} onClick={() => setEditor(g)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className={s.done ? 'lead t-ok' : 'lead t-brand'} style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}>
                          <Icon name={s.done ? 'check' : (g.icon || 'sparkle')} size={20} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{g.name}</div>
                          <div className="muted" style={{ fontSize: 12.5 }}>
                            {money(s.saved, g.currency || cur, lang)} / {money(s.target, g.currency || cur, lang)}
                            {g.targetDate && !s.done && <span> · {relativeDay(g.targetDate, lang)}</span>}
                          </div>
                        </div>
                        <b className="tnum">{Math.round(s.pct * 100)}%</b>
                      </div>

                      <div style={{ height: 8, borderRadius: 5, background: 'var(--surface-2)', overflow: 'hidden', margin: '10px 0 4px' }}>
                        <div style={{ height: '100%', width: `${Math.max(3, s.pct * 100)}%`, background: s.done ? 'var(--ok)' : 'var(--brand-500, var(--brand-400))', borderRadius: 5, transition: 'width .3s' }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        {s.done ? <Chip tint="t-ok">{t('goalReached')}</Chip>
                          : s.monthlyNeeded > 0
                            ? <span className="muted" style={{ fontSize: 12.5 }}>{money(s.monthlyNeeded, g.currency || cur, lang)} / {t('perMonth')}</span>
                            : <span className="muted" style={{ fontSize: 12.5 }}>{money(s.remaining, g.currency || cur, lang)} {t('toGo')}</span>}
                        {!s.done && <button className="btn sm" onClick={(e) => { e.stopPropagation(); setFunds(g) }}><Icon name="plus" size={14} /> {t('addFunds')}</button>}
                      </div>
                    </Card>
                  </SwipeRow>
                )
              })}
            </div>
          </>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <GoalEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {funds && <FundsSheet goal={funds} onClose={() => setFunds(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function GoalEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const goals = useCollection('goals')
  const wishlist = useCollection('wishlist')
  const [f, setF] = useState({ name: '', target: '', saved: '', currency: settings.currency, targetDate: '', icon: 'sparkle', wishId: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // Pre-fill from a wishlist item when linked.
  const onWish = (e) => {
    const id = e.target.value
    const w = wishlist.items.find(x => x.id === id)
    setF(prev => ({ ...prev, wishId: id, name: prev.name || (w ? w.name : ''), target: prev.target || (w && w.price ? String(w.price) : ''), currency: w ? (w.currency || prev.currency) : prev.currency }))
  }

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), target: parseFloat(f.target) || 0, saved: parseFloat(f.saved) || 0 }
    initial.id ? goals.save({ ...rec, id: initial.id }) : goals.add(rec)
    onSaved && onSaved(); onClose()
  }

  const openWishes = wishlist.items.filter(w => !w.purchased)

  return (
    <Sheet title={initial.id ? t('editGoal') : t('addGoal')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { goals.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      {openWishes.length > 0 && !initial.id && (
        <Field label={t('fromWishlist')} hint={t('optional')}>
          <Select value={f.wishId} onChange={onWish}>
            <option value="">{t('none')}</option>
            {openWishes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t('goalName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder={t('goalNamePlaceholder')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('goalTarget')}><Input type="number" inputMode="decimal" value={f.target} onChange={set('target')} placeholder="0" /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <div className="row2">
        <Field label={t('alreadySaved')}><Input type="number" inputMode="decimal" value={f.saved} onChange={set('saved')} placeholder="0" /></Field>
        <Field label={t('targetDate')} hint={t('optional')}><Input type="date" value={f.targetDate} onChange={set('targetDate')} /></Field>
      </div>
      <Field label={t('icon')}>
        <div className="chip-row">
          {GROUP_ICONS.map(ic => (
            <Chip key={ic} selectable on={f.icon === ic} onClick={() => setF({ ...f, icon: ic })}><Icon name={ic} size={15} /></Chip>
          ))}
        </div>
      </Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}

function FundsSheet({ goal, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const goals = useCollection('goals')
  const [amount, setAmount] = useState('')
  const s = goalStats(goal)
  const cur = goal.currency || settings.currency
  const quick = [100, 500, 1000, 5000]

  const apply = (add) => {
    const next = (Number(goal.saved) || 0) + add
    goals.save({ ...goal, saved: Math.max(0, next) })
    onSaved && onSaved(); onClose()
  }
  const submit = () => { const a = parseFloat(amount); if (a > 0) apply(a) }

  return (
    <Sheet title={`${t('addFunds')} · ${goal.name}`} onClose={onClose}
      footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <p className="muted" style={{ margin: '0 2px 10px', fontSize: 13 }}>
        {money(s.saved, cur, lang)} / {money(s.target, cur, lang)} · {money(s.remaining, cur, lang)} {t('toGo')}
      </p>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        {quick.map(q => <Chip key={q} selectable on={false} onClick={() => setAmount(String((parseFloat(amount) || 0) + q))}>+{money(q, cur, lang)}</Chip>)}
      </div>
      <Field label={t('amount')}>
        <Input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
      </Field>
    </Sheet>
  )
}
