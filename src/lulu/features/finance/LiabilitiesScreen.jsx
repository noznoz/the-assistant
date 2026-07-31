import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { LIABILITY_TYPES, findLiabilityType, label } from '../../lib/domain.js'
import { money } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function LiabilitiesScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const liabilities = useCollection('liabilities')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const totalOwed = liabilities.items.reduce((s, l) => s + (Number(l.balance) || 0), 0)
  const monthly = liabilities.items.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)

  return (
    <>
      <DetailHeader title={t('liabilities')} onBack={() => go('expenses')} right={
        liabilities.items.some(l => (Number(l.balance) || 0) > 0)
          ? <button className="iconbtn" onClick={() => go('debtpayoff')} aria-label={t('debtPayoff')}><Icon name="chart" size={18} /></button> : null
      } />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('totalOwed')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }} className="tnum t-danger">{money(totalOwed, cur, lang)}</div>
        </Card>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('monthlyPayments')} value={money(monthly, cur, lang)} />
          <Stat label={t('loans')} value={liabilities.items.length} />
        </div>

        {liabilities.items.length === 0 ? (
          <Empty icon="wallet" title={t('noLiabilities')} text={t('liabilitiesHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addLiability')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {liabilities.items.map(l => {
              const type = findLiabilityType(l.type)
              const principal = Number(l.principal) || 0
              const balance = Number(l.balance) || 0
              const paidPct = principal > 0 ? Math.min(1, Math.max(0, (principal - balance) / principal)) : 0
              return (
                <SwipeRow key={l.id} onEdit={() => setEditor(l)} onDelete={() => { liabilities.remove(l.id); toast.show(t('deletedToast')) }}>
                <Card className="tight" onClick={() => setEditor(l)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="lead t-danger" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name={type?.icon || 'wallet'} size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{l.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{[type ? label(type, lang) : '', l.lender].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <b className="tnum">{money(balance, cur, lang)}</b>
                      {Number(l.monthlyPayment) > 0 && <div className="muted" style={{ fontSize: 11 }}>{money(l.monthlyPayment, cur, lang)}/{t('perMonth')}</div>}
                    </div>
                  </div>
                  {principal > 0 && (
                    <>
                      <div className="bar-track" style={{ height: 8, marginTop: 10 }}>
                        <div className="bar-fill" style={{ width: `${paidPct * 100}%`, background: 'var(--ok)' }} />
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{Math.round(paidPct * 100)}% {t('paidOff')} · {money(principal - balance, cur, lang)} / {money(principal, cur, lang)}</div>
                    </>
                  )}
                </Card>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <LiabilityEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function LiabilityEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const liabilities = useCollection('liabilities')
  const [f, setF] = useState({ name: '', type: 'personal', lender: '', principal: '', balance: '', monthlyPayment: '', rate: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), principal: parseFloat(f.principal) || 0, balance: parseFloat(f.balance) || 0, monthlyPayment: parseFloat(f.monthlyPayment) || 0 }
    initial.id ? liabilities.save({ ...rec, id: initial.id }) : liabilities.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editLiability') : t('addLiability')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { liabilities.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('liabilityName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Home mortgage, Car loan…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('type')}>
          <Select value={f.type} onChange={set('type')} options={LIABILITY_TYPES.map(s => ({ value: s.id, label: label(s, lang) }))} />
        </Field>
        <Field label={t('lender')}><Input value={f.lender} onChange={set('lender')} placeholder="Al Rajhi, SNB…" /></Field>
      </div>
      <div className="row2">
        <Field label={t('originalAmount')}><Input type="number" inputMode="decimal" value={f.principal} onChange={set('principal')} placeholder="0" /></Field>
        <Field label={t('remainingBalance')}><Input type="number" inputMode="decimal" value={f.balance} onChange={set('balance')} placeholder="0" /></Field>
      </div>
      <div className="row2">
        <Field label={t('monthlyPayment')}><Input type="number" inputMode="decimal" value={f.monthlyPayment} onChange={set('monthlyPayment')} placeholder="0" /></Field>
        <Field label={t('interestRate')} hint="%"><Input type="number" inputMode="decimal" value={f.rate} onChange={set('rate')} placeholder="0" /></Field>
      </div>
      <Field label={t('notesField')}><Input value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}
