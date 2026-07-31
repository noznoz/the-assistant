import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Sheet, Field, Input, TextArea, Select, Button, Chip, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { GIVING_TYPES, GIVING_CAUSES, findGivingType, label } from '../../lib/domain.js'
import { money, toSar, fmtDate, todayISO } from '../../lib/format.js'
import { hijriParts } from '../../lib/hijri.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

export default function GivingScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const giving = useCollection('giving')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const hy = hijriParts(new Date())?.year
  const sar = (g) => toSar(g.amount || 0, g.currency || cur, rates)
  const inThisHijriYear = (g) => { const p = hijriParts(new Date(g.date)); return p && hy && p.year === hy }

  const stats = useMemo(() => {
    const yr = giving.items.filter(inThisHijriYear)
    const total = yr.reduce((s, g) => s + sar(g), 0)
    const zakat = yr.filter(g => g.type === 'zakat' || g.type === 'zakat_fitr').reduce((s, g) => s + sar(g), 0)
    const sadaqah = yr.filter(g => g.type === 'sadaqah').reduce((s, g) => s + sar(g), 0)
    return { total, zakat, sadaqah, count: yr.length }
  }, [giving.items, rates])

  const sorted = giving.items.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <>
      <DetailHeader title={t('giving')} onBack={() => go('more')} right={
        <button className="iconbtn" onClick={() => go('zakat')} aria-label={t('zakat')}><Icon name="sparkle" size={18} /></button>
      } />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('givenThisYear')}{hy ? ` · ${hy} ${t('ah')}` : ''}</div>
          <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }} className="tnum">{money(stats.total, cur, lang)}</div>
        </Card>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('zakatPaid')} value={money(stats.zakat, cur, lang)} onClick={() => go('zakat')} />
          <Stat label={t('sadaqah')} value={money(stats.sadaqah, cur, lang)} />
        </div>

        {giving.items.length === 0 ? (
          <Empty icon="gift" title={t('noGiving')} text={t('givingHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('recordGiving')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {sorted.map(g => {
              const ty = findGivingType(g.type)
              return (
                <SwipeRow key={g.id} onEdit={() => setEditor(g)} onDelete={() => { giving.remove(g.id); toast.show(t('deletedToast')) }}>
                  <div className="li" onClick={() => setEditor(g)}>
                    <div className="lead t-brand"><Icon name={ty?.icon || 'gift'} size={18} /></div>
                    <div className="body">
                      <div className="title">{g.cause || (ty ? label(ty, lang) : t('giving'))}</div>
                      <div className="meta">{ty ? label(ty, lang) : ''} · {fmtDate(g.date, lang, settings.dateFormat)}</div>
                    </div>
                    <b className="tnum">{money(g.amount, g.currency || cur, lang)}</b>
                  </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <GivingEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function GivingEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const giving = useCollection('giving')
  const [f, setF] = useState({ type: 'sadaqah', amount: '', currency: settings.currency, cause: '', date: todayISO(), note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!(parseFloat(f.amount) > 0)) { setErr(t('required')); return }
    const rec = { ...f, amount: parseFloat(f.amount) }
    initial.id ? giving.save({ ...rec, id: initial.id }) : giving.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editGiving') : t('recordGiving')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { giving.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('type')}>
        <Select value={f.type} onChange={set('type')} options={GIVING_TYPES.map(x => ({ value: x.id, label: label(x, lang) }))} />
      </Field>
      <div className="row2">
        <Field label={t('amount')} required error={err}><Input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" autoFocus /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <Field label={t('cause')} hint={t('optional')}><Input value={f.cause} onChange={set('cause')} placeholder={t('causePlaceholder')} /></Field>
      <div className="chip-row" style={{ marginTop: -6, marginBottom: 12 }}>
        {GIVING_CAUSES.slice(0, 6).map(c => <Chip key={c} selectable on={f.cause === c} onClick={() => setF({ ...f, cause: c })}>{c}</Chip>)}
      </div>
      <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
