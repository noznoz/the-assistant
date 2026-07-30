import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Sheet, Field, Input, TextArea, Chip, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, fmtDate, todayISO } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

// Accessories fitted to a vehicle (roof rack, dash cam, tint…): name, cost, date.
export default function AccessoriesPanel({ vehicle }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const accessories = useCollection('accessories')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const mine = accessories.items.filter(a => a.vehicleId === vehicle.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const total = mine.reduce((s, a) => s + (Number(a.cost) || 0), 0)

  return (
    <>
      <Card style={{ textAlign: 'center', marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('accessoriesValue')}</div>
        <div style={{ fontSize: 28, fontWeight: 750, marginTop: 4 }} className="tnum">{money(total, cur, lang)}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{mine.length} {mine.length === 1 ? t('item') : t('items')}</div>
      </Card>

      <Button block variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addAccessory')}</Button>

      {mine.length === 0 ? (
        <Empty icon="wrench" title={t('noAccessories')} text={t('accessoriesHint')} />
      ) : (
        <div style={{ marginTop: 12 }}>
          {mine.map(a => (
            <SwipeRow key={a.id} onEdit={() => setEditor(a)} onDelete={() => { accessories.remove(a.id); toast.show(t('deletedToast')) }}>
            <div className="li" onClick={() => setEditor(a)}>
              <div className="lead t-brand"><Icon name="wrench" size={18} /></div>
              <div className="body">
                <div className="title">{a.name}</div>
                <div className="meta">
                  {[a.date && fmtDate(a.date, lang, settings.dateFormat), a.note].filter(Boolean).join(' · ')}
                  {a.fitted && <span className="chip t-ok" style={{ padding: '1px 7px' }}>{t('fitted')}</span>}
                </div>
              </div>
              {Number(a.cost) > 0 ? <b className="tnum">{money(a.cost, cur, lang)}</b> : null}
            </div>
            </SwipeRow>
          ))}
        </div>
      )}
      {editor && <AccessoryEditor initial={editor.id ? editor : {}} vehicleId={vehicle.id} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function AccessoryEditor({ initial, vehicleId, onClose, onSaved }) {
  const { t } = useT()
  const accessories = useCollection('accessories')
  const [f, setF] = useState({ name: '', cost: '', date: todayISO(), note: '', fitted: true, vehicleId, ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), cost: parseFloat(f.cost) || 0 }
    initial.id ? accessories.save({ ...rec, id: initial.id }) : accessories.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editAccessory') : t('addAccessory')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { accessories.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('accessoryName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Roof rack, dash cam…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('cost')}><Input type="number" inputMode="decimal" value={f.cost} onChange={set('cost')} placeholder="0" /></Field>
        <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="chip-row">
          <Chip selectable on={!!f.fitted} onClick={() => setF({ ...f, fitted: !f.fitted })}>{t('fitted')}</Chip>
        </div>
      </div>
      <Field label={t('notesField')}><TextArea value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}
