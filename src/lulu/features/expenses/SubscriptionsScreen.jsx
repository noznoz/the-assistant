import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { categoryOptions, PAYMENT_METHODS, catLabel, label } from '../../lib/domain.js'
import { money, fmtDate, daysUntil, todayISO, toSar } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CYCLES = [{ id: 'weekly', key: 'weekly' }, { id: 'monthly', key: 'monthly' }, { id: 'yearly', key: 'yearly' }]

export function monthlyEquivalent(amount, cycle) {
  const a = Number(amount) || 0
  if (cycle === 'weekly') return a * 52 / 12
  if (cycle === 'yearly') return a / 12
  return a
}
function advance(dateStr, cycle) {
  const d = new Date(dateStr || todayISO())
  if (cycle === 'weekly') d.setDate(d.getDate() + 7)
  else if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export default function SubscriptionsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const subs = useCollection('subscriptions')
  const expenses = useCollection('expenses')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const active = subs.items.filter(s => s.active !== false)
  const monthly = active.reduce((sum, s) => sum + monthlyEquivalent(toSar(s.amount, s.currency || 'SAR', settings.rates), s.cycle), 0)
  const sorted = [...subs.items].sort((a, b) => (a.nextDue || '9999').localeCompare(b.nextDue || '9999'))

  const markPaid = (s) => {
    // log an expense and advance the next-due date
    expenses.add({ amount: Number(s.amount) || 0, currency: s.currency || cur, category: s.category || 'subscriptions', merchant: s.name, method: s.method || 'credit', date: s.nextDue || todayISO(), classification: 'personal' })
    subs.patch(s.id, { nextDue: advance(s.nextDue, s.cycle) })
    toast.show('✓ ' + t('markPaid'))
  }

  return (
    <>
      <DetailHeader title={t('subscriptions')} onBack={() => go('expenses')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('monthlyCommitment')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }} className="tnum">{money(monthly, cur, lang)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{active.length} {t('active')}</div>
        </Card>

        {subs.items.length === 0 ? (
          <Empty icon="wallet" title={t('noSubs')} text={t('subsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newSubscription')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {sorted.map(s => {
              const dd = daysUntil(s.nextDue)
              return (
                <SwipeRow key={s.id} onEdit={() => setEditor(s)} onDelete={() => { subs.remove(s.id); toast.show(t('deletedToast')) }}>
                <div className="li">
                  <div className="lead t-brand"><Icon name="wallet" size={18} /></div>
                  <div className="body" onClick={() => setEditor(s)}>
                    <div className="title">{s.name}</div>
                    <div className="meta">
                      {money(s.amount, s.currency || cur, lang)} · {t(s.cycle || 'monthly')}
                      {s.nextDue && <span className={dd != null && dd <= 3 ? 't-warn' : ''} style={dd != null && dd <= 3 ? { padding: '1px 6px', borderRadius: 6 } : undefined}>· {t('nextDue')} {fmtDate(s.nextDue, lang, settings.dateFormat)}</span>}
                    </div>
                  </div>
                  <button className="btn sm" onClick={() => markPaid(s)}>{t('markPaid')}</button>
                </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <SubscriptionEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function SubscriptionEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const subs = useCollection('subscriptions')
  const [f, setF] = useState({ name: '', amount: '', currency: settings.currency, cycle: 'monthly', category: 'subscriptions', method: 'credit', nextDue: todayISO(), active: true, note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim() || !(parseFloat(f.amount) > 0)) { setErr(t('required')); return }
    const rec = { ...f, amount: parseFloat(f.amount) }
    initial.id ? subs.save({ ...rec, id: initial.id }) : subs.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('edit') : t('newSubscription')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { subs.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('title')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Netflix, Rent…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('amount')}><Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" /></Field>
        <Field label={t('cycle')}><Select value={f.cycle} onChange={set('cycle')} options={CYCLES.map(c => ({ value: c.id, label: t(c.key) }))} /></Field>
      </div>
      <Field label={t('nextDue')}><Input type="date" value={f.nextDue} onChange={set('nextDue')} /></Field>
      <div className="row2">
        <Field label={t('category')}>
          <Select value={f.category} onChange={set('category')} options={categoryOptions(lang, settings.customCategories)} />
        </Field>
        <Field label={t('paymentMethod')}>
          <Select value={f.method} onChange={set('method')} options={PAYMENT_METHODS.map(m => ({ value: m.id, label: label(m, lang) }))} />
        </Field>
      </div>
    </Sheet>
  )
}
