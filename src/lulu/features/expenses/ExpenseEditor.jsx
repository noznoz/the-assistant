import React, { useState } from 'react'
import { Sheet, Field, Input, TextArea, Select, Button, Chip } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, label } from '../../lib/domain.js'
import { todayISO } from '../../lib/format.js'

export default function ExpenseEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const [f, setF] = useState({
    amount: '', currency: settings.currency, category: 'other', merchant: '',
    method: 'credit', date: todayISO(), classification: 'personal',
    reimbursable: false, relatedVehicle: '', note: '', liters: '', odometer: '', ...initial,
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = () => {
    const amt = parseFloat(f.amount)
    if (!amt || amt <= 0) { setErr(t('required')); return }
    const rec = { ...f, amount: amt }
    if (initial?.id) expenses.save({ ...rec, id: initial.id })
    else expenses.add(rec)
    onSaved && onSaved()
    onClose()
  }

  return (
    <Sheet title={t('newExpense')} onClose={onClose}
      footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <div className="row2">
        <Field label={t('amount')} required error={err}>
          <Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" autoFocus />
        </Field>
        <Field label={t('currency')}>
          <Select value={f.currency} onChange={set('currency')} options={['SAR','USD','EUR','AED'].map(c => ({ value: c, label: c }))} />
        </Field>
      </div>

      <Field label={t('category')}>
        <Select value={f.category} onChange={set('category')}
          options={EXPENSE_CATEGORIES.map(c => ({ value: c.id, label: label(c, lang) }))} />
      </Field>

      <div className="row2">
        <Field label={t('merchant')}><Input value={f.merchant} onChange={set('merchant')} /></Field>
        <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      </div>

      {f.category === 'fuel' && (
        <div className="row2">
          <Field label={t('liters')} hint={t('optional')}><Input type="number" inputMode="decimal" value={f.liters} onChange={set('liters')} placeholder="0" /></Field>
          <Field label={t('odometer')} hint="km"><Input type="number" inputMode="numeric" value={f.odometer} onChange={set('odometer')} placeholder="0" /></Field>
        </div>
      )}

      <Field label={t('paymentMethod')}>
        <Select value={f.method} onChange={set('method')}
          options={PAYMENT_METHODS.map(m => ({ value: m.id, label: label(m, lang) }))} />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <div className="chip-row">
          <Chip selectable on={f.classification === 'work'} onClick={() => setF({ ...f, classification: 'work' })}>{t('work')}</Chip>
          <Chip selectable on={f.classification === 'personal'} onClick={() => setF({ ...f, classification: 'personal' })}>{t('personal')}</Chip>
          <Chip selectable on={f.reimbursable} onClick={() => setF({ ...f, reimbursable: !f.reimbursable })}>{t('reimbursable')}</Chip>
        </div>
      </div>

      {vehicles.items.length > 0 && (
        <Field label={t('relatedVehicle')}>
          <Select value={f.relatedVehicle} onChange={set('relatedVehicle')}>
            <option value="">{t('none')}</option>
            {vehicles.items.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
      )}

      <Field label={t('notesField')}><TextArea value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}
