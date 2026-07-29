import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { INVESTMENT_TYPES, findInvestmentType, label } from '../../lib/domain.js'
import { money, toSar, fmtDate, todayISO } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

export default function InvestmentsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const investments = useCollection('investments')
  const income = useCollection('income')
  const [editor, setEditor] = useState(null)
  const [dividend, setDividend] = useState(null)   // investment to log a dividend for
  const toast = useToast()

  const sar = (a, c) => toSar(a, c || 'SAR', rates)
  const portfolio = investments.items.reduce((s, v) => s + sar(v.currentValue || v.invested, v.currency), 0)
  const invested = investments.items.reduce((s, v) => s + sar(v.invested, v.currency), 0)
  const gain = portfolio - invested
  const dividendsTotal = income.items.filter(i => i.source === 'dividend').reduce((s, i) => s + sar(i.amount, i.currency), 0)

  const dividendFor = (id) => income.items.filter(i => i.source === 'dividend' && i.investmentId === id).reduce((s, i) => s + sar(i.amount, i.currency), 0)

  return (
    <>
      <DetailHeader title={t('investments')} onBack={() => go('expenses')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('portfolioValue')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }} className="tnum">{money(portfolio, cur, lang)}</div>
          {invested > 0 && (
            <div className={`muted ${gain >= 0 ? 't-ok' : 't-danger'}`} style={{ fontSize: 13, marginTop: 4, fontWeight: 650 }}>
              {gain >= 0 ? '▲' : '▼'} {money(Math.abs(gain), cur, lang)} ({invested ? Math.round(gain / invested * 100) : 0}%)
            </div>
          )}
        </Card>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('invested')} value={money(invested, cur, lang)} />
          <Stat label={t('dividendsReceived')} value={money(dividendsTotal, cur, lang)} onClick={() => go('income')} />
        </div>

        {investments.items.length === 0 ? (
          <Empty icon="chart" title={t('noInvestments')} text={t('investmentsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addInvestment')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {investments.items.map(v => {
              const type = findInvestmentType(v.type)
              const value = sar(v.currentValue || v.invested, v.currency)
              const inv = sar(v.invested, v.currency)
              const g = value - inv
              const div = dividendFor(v.id)
              return (
                <SwipeRow key={v.id} onEdit={() => setEditor(v)} onDelete={() => { investments.remove(v.id); toast.show(t('deletedToast')) }}>
                <div className="li" onClick={() => setEditor(v)}>
                  <div className="lead t-brand"><Icon name={type?.icon || 'chart'} size={18} /></div>
                  <div className="body">
                    <div className="title">{v.name}</div>
                    <div className="meta">
                      {type ? label(type, lang) : ''}
                      {inv > 0 && <span className={g >= 0 ? 't-ok' : 't-danger'}>{g >= 0 ? '▲' : '▼'} {money(Math.abs(g), cur, lang)}</span>}
                      {div > 0 && <span className="chip t-ok" style={{ padding: '1px 7px' }}>{t('dividend')} {money(div, cur, lang)}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <b className="tnum">{money(value, cur, lang)}</b>
                    <button className="btn sm" style={{ marginTop: 4 }} onClick={(e) => { e.stopPropagation(); setDividend(v) }}>{t('logDividend')}</button>
                  </div>
                </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <InvestmentEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {dividend && <DividendSheet investment={dividend} onClose={() => setDividend(null)} onSaved={() => toast.show('✓ ' + t('dividend'))} />}
      {toast.node}
    </>
  )
}

function InvestmentEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const investments = useCollection('investments')
  const [f, setF] = useState({ name: '', type: 'stocks', invested: '', currentValue: '', currency: settings.currency, note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), invested: parseFloat(f.invested) || 0, currentValue: parseFloat(f.currentValue) || 0 }
    initial.id ? investments.save({ ...rec, id: initial.id }) : investments.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editInvestment') : t('addInvestment')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { investments.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('holdingName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Aramco, Rental flat…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('type')}>
          <Select value={f.type} onChange={set('type')} options={INVESTMENT_TYPES.map(s => ({ value: s.id, label: label(s, lang) }))} />
        </Field>
        <Field label={t('currency')}>
          <Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} />
        </Field>
      </div>
      <div className="row2">
        <Field label={t('amountInvested')}><Input type="number" inputMode="decimal" value={f.invested} onChange={set('invested')} placeholder="0" /></Field>
        <Field label={t('currentValue')}><Input type="number" inputMode="decimal" value={f.currentValue} onChange={set('currentValue')} placeholder="0" /></Field>
      </div>
      <Field label={t('notesField')}><Input value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}

function DividendSheet({ investment, onClose, onSaved }) {
  const { t } = useT()
  const { settings } = useSettings()
  const income = useCollection('income')
  const [f, setF] = useState({ amount: '', currency: investment.currency || settings.currency, date: todayISO() })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!(parseFloat(f.amount) > 0)) { setErr(t('required')); return }
    income.add({ source: 'dividend', investmentId: investment.id, amount: parseFloat(f.amount), currency: f.currency, date: f.date, recurring: false, note: investment.name })
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={`${t('logDividend')} · ${investment.name}`} onClose={onClose}
      footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <div className="row2">
        <Field label={t('amount')} required error={err}><Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" autoFocus /></Field>
        <Field label={t('currency')}>
          <Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} />
        </Field>
      </div>
      <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      <p className="hint" style={{ margin: '0 2px' }}>{t('dividendHint')}</p>
    </Sheet>
  )
}
