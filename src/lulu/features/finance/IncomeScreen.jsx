import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, Select, Chip, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { INCOME_SOURCES, findIncomeSource, label } from '../../lib/domain.js'
import { money, toSar, fmtDate, isSameMonth, todayISO } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function IncomeScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const income = useCollection('income')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const rates = settings.rates
  const thisMonth = income.items.filter(i => isSameMonth(i.date))
  const monthTotal = thisMonth.reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)
  const recurring = income.items.filter(i => i.recurring)
  const recurringTotal = recurring.reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)
  const sorted = [...income.items].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <>
      <DetailHeader title={t('income')} onBack={() => go('expenses')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('incomeThisMonth')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }} className="tnum t-ok">{money(monthTotal, cur, lang)}</div>
        </Card>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('recurringMonthly')} value={money(recurringTotal, cur, lang)} sub={`${recurring.length} ${t('sources')}`} />
          <Stat label={t('entries')} value={thisMonth.length} />
        </div>

        {income.items.length === 0 ? (
          <Empty icon="wallet" title={t('noIncome')} text={t('incomeHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addIncome')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {sorted.map(i => {
              const src = findIncomeSource(i.source)
              return (
                <SwipeRow key={i.id} onEdit={() => setEditor(i)} onDelete={() => { income.remove(i.id); toast.show(t('deletedToast')) }}>
                <div className="li" onClick={() => setEditor(i)}>
                  <div className="lead t-ok"><Icon name={src?.icon || 'wallet'} size={18} /></div>
                  <div className="body">
                    <div className="title">{i.note || (src ? label(src, lang) : t('income'))}</div>
                    <div className="meta">
                      {src ? label(src, lang) : ''} · {fmtDate(i.date, lang, settings.dateFormat)}
                      {i.recurring && <span className="chip t-brand" style={{ padding: '1px 7px' }}>{t('monthlyLabel')}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <b className="tnum t-ok">+{money(i.amount, i.currency || cur, lang)}</b>
                    {(i.currency && i.currency !== 'SAR') && <div className="muted tnum" style={{ fontSize: 11 }}>≈ {money(toSar(i.amount, i.currency, rates), 'SAR', lang)}</div>}
                  </div>
                </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <IncomeEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

export function IncomeEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const income = useCollection('income')
  const [f, setF] = useState({ source: 'salary', amount: '', currency: settings.currency, date: todayISO(), recurring: true, note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!(parseFloat(f.amount) > 0)) { setErr(t('required')); return }
    const rec = { ...f, amount: parseFloat(f.amount) }
    initial.id ? income.save({ ...rec, id: initial.id }) : income.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editIncome') : t('addIncome')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { income.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('source')}>
        <Select value={f.source} onChange={set('source')} options={INCOME_SOURCES.map(s => ({ value: s.id, label: label(s, lang) }))} />
      </Field>
      <div className="row2">
        <Field label={t('amount')} required error={err}><Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" autoFocus /></Field>
        <Field label={t('currency')}>
          <Select value={f.currency} onChange={set('currency')} options={['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR'].map(c => ({ value: c, label: c }))} />
        </Field>
      </div>
      {f.currency && f.currency !== 'SAR' && parseFloat(f.amount) > 0 && (
        <p className="hint" style={{ marginTop: -8, marginBottom: 12, fontWeight: 600, color: 'var(--brand-600)' }}>
          ≈ {money(toSar(f.amount, f.currency, settings.rates), 'SAR', lang)} {t('inSar')}
        </p>
      )}
      <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      <div style={{ marginBottom: 16 }}>
        <div className="chip-row">
          <Chip selectable on={f.recurring} onClick={() => setF({ ...f, recurring: !f.recurring })}>{t('recurringMonthlyChip')}</Chip>
        </div>
      </div>
      <Field label={t('notesField')}><Input value={f.note} onChange={set('note')} placeholder={t('incomeNotePlaceholder')} /></Field>
    </Sheet>
  )
}
