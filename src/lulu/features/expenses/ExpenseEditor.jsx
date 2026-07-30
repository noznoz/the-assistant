import React, { useState } from 'react'
import { Sheet, Field, Input, TextArea, Select, Button, Chip } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { PAYMENT_METHODS, categoryOptions, label } from '../../lib/domain.js'
import { todayISO, toSar, money } from '../../lib/format.js'
import { defaultAccountName } from '../../lib/accounts.js'

export default function ExpenseEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const projects = useCollection('projects')
  const trips = useCollection('trips')
  const accountsCol = useCollection('accounts')
  const [f, setF] = useState({
    amount: '', currency: settings.currency, category: 'other', merchant: '',
    method: 'credit', date: todayISO(), classification: 'personal', kind: 'monthly',
    account: defaultAccountName(accountsCol.items),
    reimbursable: false, relatedVehicle: '', projectId: '', tripId: '', item: '', note: '', liters: '', odometer: '',
    installmentMonths: '', ...initial,
  })
  const [err, setErr] = useState('')
  const [newCat, setNewCat] = useState(null)      // inline "add category" text or null
  const [newProj, setNewProj] = useState(null)    // inline "add project" text or null
  const [newAcct, setNewAcct] = useState(null)    // inline "add account" text or null
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const onCategory = (e) => {
    if (e.target.value === '__addcat') { setNewCat(''); return }
    setF({ ...f, category: e.target.value })
  }
  const addCategory = () => {
    const name = (newCat || '').trim()
    if (!name) { setNewCat(null); return }
    if (!(settings.customCategories || []).includes(name)) {
      updateSettings({ customCategories: [...(settings.customCategories || []), name] })
    }
    setF({ ...f, category: 'custom:' + name })
    setNewCat(null)
  }

  const onProject = (e) => {
    if (e.target.value === '__addproj') { setNewProj(''); return }
    setF({ ...f, projectId: e.target.value })
  }

  const accounts = accountsCol.items.map(a => a.name)
  const onAccount = (e) => {
    if (e.target.value === '__addacct') { setNewAcct(''); return }
    setF({ ...f, account: e.target.value })
  }
  const addAccount = () => {
    const name = (newAcct || '').trim()
    if (!name) { setNewAcct(null); return }
    if (!accounts.includes(name)) accountsCol.add({ name, type: 'current', openingBalance: 0, includeInNet: true, isDefault: false })
    setF({ ...f, account: name })
    setNewAcct(null)
  }
  const addProject = () => {
    const name = (newProj || '').trim()
    if (!name) { setNewProj(null); return }
    const rec = projects.add({ name })
    setF({ ...f, projectId: rec.id })
    setNewProj(null)
  }

  const submit = () => {
    const amt = parseFloat(f.amount)
    if (!amt || amt <= 0) { setErr(t('required')); return }
    const rec = { ...f, amount: amt }
    if (initial?.id) expenses.save({ ...rec, id: initial.id })
    else expenses.add(rec)
    onSaved && onSaved()
    onClose()
  }

  const doDelete = () => {
    if (!window.confirm(t('deleteExpenseQ'))) return
    expenses.remove(initial.id)
    onClose()
  }

  const catOpts = categoryOptions(lang, settings.customCategories)

  return (
    <Sheet title={initial?.id ? t('editExpense') : t('newExpense')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial?.id && <Button block variant="danger" icon="trash" onClick={doDelete}>{t('delete')}</Button>}
      </div>}>
      <div className="row2">
        <Field label={t('amount')} required error={err}>
          <Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" autoFocus />
        </Field>
        <Field label={t('currency')}>
          <Select value={f.currency} onChange={set('currency')} options={['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR'].map(c => ({ value: c, label: c }))} />
        </Field>
      </div>
      {f.currency && f.currency !== 'SAR' && parseFloat(f.amount) > 0 && (
        <p className="hint" style={{ marginTop: -8, marginBottom: 12, fontWeight: 600, color: 'var(--brand-600)' }}>
          ≈ {money(toSar(f.amount, f.currency, settings.rates), 'SAR', lang)} {t('inSar')}
        </p>
      )}

      <Field label={t('category')}>
        <Select value={f.category} onChange={onCategory}>
          {catOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          <option value="__addcat">{t('addCategory')}</option>
        </Select>
      </Field>
      {newCat != null && (
        <div className="row2" style={{ marginTop: -6, marginBottom: 12 }}>
          <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder={t('customCategoryName')} autoFocus />
          <Button onClick={addCategory}>{t('add')}</Button>
        </div>
      )}

      {/* Project */}
      <Field label={t('project')}>
        <Select value={f.projectId} onChange={onProject}>
          <option value="">{t('none')}</option>
          {projects.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__addproj">{t('addProject')}</option>
        </Select>
      </Field>
      {newProj != null && (
        <div className="row2" style={{ marginTop: -6, marginBottom: 12 }}>
          <Input value={newProj} onChange={e => setNewProj(e.target.value)} placeholder={t('projectName')} autoFocus />
          <Button onClick={addProject}>{t('add')}</Button>
        </div>
      )}

      <Field label={t('item')}><Input value={f.item} onChange={set('item')} placeholder={t('itemPlaceholder')} /></Field>

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

      {f.method === 'installment' && (
        <>
          <Field label={t('installmentMonths')}>
            <Input type="number" inputMode="numeric" value={f.installmentMonths} onChange={set('installmentMonths')} placeholder="12" />
          </Field>
          {parseFloat(f.amount) > 0 && parseInt(f.installmentMonths) > 0 && (
            <p className="hint" style={{ marginTop: -8, marginBottom: 12, fontWeight: 600, color: 'var(--brand-600)' }}>
              ≈ {money(parseFloat(f.amount) / parseInt(f.installmentMonths), f.currency, lang)} / {t('perMonth')} × {parseInt(f.installmentMonths)}
            </p>
          )}
        </>
      )}

      <Field label={t('paidFrom')}>
        <Select value={f.account} onChange={onAccount}>
          <option value="">{t('none')}</option>
          {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          <option value="__addacct">{t('addAccount')}</option>
        </Select>
      </Field>
      {newAcct != null && (
        <div className="row2" style={{ marginTop: -6, marginBottom: 12 }}>
          <Input value={newAcct} onChange={e => setNewAcct(e.target.value)} placeholder={t('accountNamePlaceholder')} autoFocus />
          <Button onClick={addAccount}>{t('add')}</Button>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '0 2px 7px' }}>{t('expenseKind')}</label>
        <div className="chip-row">
          <Chip selectable on={(f.kind || 'monthly') !== 'special'} onClick={() => setF({ ...f, kind: 'monthly' })}>{t('expMonthly')}</Chip>
          <Chip selectable on={f.kind === 'special'} onClick={() => setF({ ...f, kind: 'special' })}>{t('expSpecial')}</Chip>
        </div>
      </div>

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

      {trips.items.length > 0 && (
        <Field label={t('relatedTrip')}>
          <Select value={f.tripId} onChange={set('tripId')}>
            <option value="">{t('none')}</option>
            {trips.items.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
          </Select>
        </Field>
      )}

      <Field label={t('notesField')}><TextArea value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}
