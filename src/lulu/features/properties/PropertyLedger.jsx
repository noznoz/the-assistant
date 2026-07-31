import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Stat, Section, Sheet, Field, Input, TextArea, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { PROPERTY_LOG_KINDS, findPropertyLogKind, label } from '../../lib/domain.js'
import { money, toSar, fmtDate, todayISO } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

// Per-property ledger: rent received vs bills, maintenance and fees.
export default function PropertyLedger({ property }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const logs = useCollection('propertylog')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const mine = logs.items.filter(l => l.propertyId === property.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const sar = (l) => toSar(l.amount || 0, l.currency || cur, rates)
  const isIncome = (l) => (findPropertyLogKind(l.kind) || {}).income
  const rentIn = mine.filter(isIncome).reduce((s, l) => s + sar(l), 0)
  const costOut = mine.filter(l => !isIncome(l)).reduce((s, l) => s + sar(l), 0)
  const net = rentIn - costOut

  return (
    <>
      <div className="stat-grid">
        <Stat label={t('rentCollected')} value={money(rentIn, cur, lang)} />
        <Stat label={t('runningCosts')} value={money(costOut, cur, lang)} />
      </div>
      <Card style={{ textAlign: 'center', marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('netIncome')}</div>
        <div className={`tnum ${net >= 0 ? 't-ok' : 't-danger'}`} style={{ fontSize: 28, fontWeight: 780, marginTop: 4 }}>{net >= 0 ? '+' : ''}{money(net, cur, lang)}</div>
      </Card>

      <Section title={t('ledger')} count={mine.length} action={t('add')} onAction={() => setEditor({})} />
      {mine.length === 0 ? (
        <Empty icon="wallet" title={t('nothingHere')} text={t('propertyLedgerHint')} />
      ) : mine.map(l => {
        const k = findPropertyLogKind(l.kind)
        const inc = isIncome(l)
        return (
          <SwipeRow key={l.id} onEdit={() => setEditor(l)} onDelete={() => { logs.remove(l.id); toast.show(t('deletedToast')) }}>
            <div className="li" onClick={() => setEditor(l)}>
              <div className={`lead ${inc ? 't-ok' : 't-warn'}`}><Icon name={k?.icon || 'wallet'} size={18} /></div>
              <div className="body">
                <div className="title">{l.note || (k ? label(k, lang) : '')}</div>
                <div className="meta">{k ? label(k, lang) : ''} · {fmtDate(l.date, lang, settings.dateFormat)}</div>
              </div>
              <b className={`tnum ${inc ? 't-ok' : ''}`}>{inc ? '+' : '−'}{money(l.amount, l.currency || cur, lang)}</b>
            </div>
          </SwipeRow>
        )
      })}

      <Fab onClick={() => setEditor({})} />
      {editor && <LedgerEditor propertyId={property.id} initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function LedgerEditor({ propertyId, initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const logs = useCollection('propertylog')
  const [f, setF] = useState({ propertyId, kind: 'rent', amount: '', currency: settings.currency, date: todayISO(), note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!(parseFloat(f.amount) > 0)) { setErr(t('required')); return }
    const rec = { ...f, amount: parseFloat(f.amount) }
    initial.id ? logs.save({ ...rec, id: initial.id }) : logs.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('edit') : t('addEntry')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { logs.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('kind')}><Select value={f.kind} onChange={set('kind')} options={PROPERTY_LOG_KINDS.map(k => ({ value: k.id, label: label(k, lang) }))} /></Field>
      <div className="row2">
        <Field label={t('amount')} required error={err}><Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" autoFocus /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
