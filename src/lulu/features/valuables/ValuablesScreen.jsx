import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, TextArea, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { VALUABLE_CATEGORIES, findValuableCategory, label } from '../../lib/domain.js'
import { money, toSar, fmtDate, daysUntil } from '../../lib/format.js'
import { saveAttachment, removeAttachment } from '../../lib/files.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

export default function ValuablesScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const valuables = useCollection('valuables')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const total = valuables.items.reduce((s, v) => s + toSar(v.value, v.currency || 'SAR', rates), 0)
  const underWarranty = valuables.items.filter(v => { const dd = daysUntil(v.warrantyExpiry); return dd != null && dd >= 0 }).length
  const sorted = [...valuables.items].sort((a, b) => (a.warrantyExpiry || '9999').localeCompare(b.warrantyExpiry || '9999'))

  return (
    <>
      <DetailHeader title={t('valuables')} onBack={() => go('more')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('totalValue')}</div>
          <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }} className="tnum">{money(total, cur, lang)}</div>
        </Card>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('items')} value={valuables.items.length} />
          <Stat label={t('underWarranty')} value={underWarranty} />
        </div>

        {valuables.items.length === 0 ? (
          <Empty icon="gift" title={t('noValuables')} text={t('valuablesHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addValuable')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {sorted.map(v => {
              const c = findValuableCategory(v.category)
              const dd = daysUntil(v.warrantyExpiry)
              return (
                <SwipeRow key={v.id} onEdit={() => setEditor(v)} onDelete={() => { valuables.remove(v.id); toast.show(t('deletedToast')) }}>
                <div className="li" onClick={() => setEditor(v)}>
                  <div className="lead t-brand"><Icon name={c?.icon || 'gift'} size={18} /></div>
                  <div className="body">
                    <div className="title">{v.name}</div>
                    <div className="meta">
                      {[c ? label(c, lang) : '', [v.brand, v.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                      {(v.receipts || []).length > 0 && <span className="chip" style={{ padding: '1px 7px' }}><Icon name="receipt" size={11} /></span>}
                      {v.warrantyExpiry && <span className={dd != null && dd < 0 ? 'muted' : dd != null && dd <= 30 ? 't-warn' : 't-ok'} style={dd != null && dd <= 30 ? { padding: '1px 6px', borderRadius: 6 } : undefined}>
                        {dd != null && dd < 0 ? t('warrantyExpired') : `${t('warranty')}: ${fmtDate(v.warrantyExpiry, lang, settings.dateFormat)}`}
                      </span>}
                    </div>
                  </div>
                  {Number(v.value) > 0 && <b className="tnum">{money(v.value, v.currency || cur, lang)}</b>}
                </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <ValuableEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function ValuableEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const valuables = useCollection('valuables')
  const [f, setF] = useState({ name: '', category: 'electronics', brand: '', model: '', serial: '', purchaseDate: '', value: '', currency: settings.currency, warrantyExpiry: '', note: '', receipts: [], ...initial })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const camRef = useRef()
  const fileRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const addReceipts = async (fl) => {
    if (!fl || !fl.length) return
    setBusy(true)
    try { const added = []; for (const file of Array.from(fl)) added.push(await saveAttachment(file)); setF(p => ({ ...p, receipts: [...(p.receipts || []), ...added] })) }
    finally { setBusy(false) }
  }
  const removeReceipt = async (att) => { await removeAttachment(att); setF(p => ({ ...p, receipts: (p.receipts || []).filter(a => a.id !== att.id) })) }

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), value: parseFloat(f.value) || 0 }
    initial.id ? valuables.save({ ...rec, id: initial.id }) : valuables.add(rec)
    onSaved && onSaved(); onClose()
  }

  return (
    <Sheet title={initial.id ? t('editValuable') : t('addValuable')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { valuables.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('valuableName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="iPhone 16 Pro, Rolex…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('category')}><Select value={f.category} onChange={set('category')} options={VALUABLE_CATEGORIES.map(c => ({ value: c.id, label: label(c, lang) }))} /></Field>
        <Field label={t('brand')}><Input value={f.brand} onChange={set('brand')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('model')}><Input value={f.model} onChange={set('model')} /></Field>
        <Field label={t('serialNumber')}><Input value={f.serial} onChange={set('serial')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('value')}><Input type="number" inputMode="decimal" value={f.value} onChange={set('value')} placeholder="0" /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <div className="row2">
        <Field label={t('purchaseDate')}><Input type="date" value={f.purchaseDate} onChange={set('purchaseDate')} /></Field>
        <Field label={t('warrantyExpiry')}><Input type="date" value={f.warrantyExpiry} onChange={set('warrantyExpiry')} /></Field>
      </div>

      <Field label={t('receipt')}>
        <div className="row2">
          <Button icon="camera" onClick={() => camRef.current?.click()}>{t('takePhoto')}</Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>{t('chooseFile')}</Button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { addReceipts(e.target.files); e.target.value = '' }} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={e => { addReceipts(e.target.files); e.target.value = '' }} />
        {busy && <p className="muted" style={{ fontSize: 12, margin: '4px 2px' }}><span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle' }} /> …</p>}
        {(f.receipts || []).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>
            {f.receipts.map(a => (
              <div key={a.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                {a.thumb ? <img src={a.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)' }}><Icon name="doc" size={20} /></div>}
                <button onClick={() => removeReceipt(a)} aria-label={t('delete')} style={{ position: 'absolute', top: 2, insetInlineEnd: 2, width: 20, height: 20, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="x" size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
