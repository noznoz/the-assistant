import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Field, Input, TextArea, Select, Button, Chip } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { VEHICLE_TYPES, OWNERSHIP_STATUSES, label } from '../../lib/domain.js'
import { imageToDataURL } from '../../lib/files.js'

export default function VehicleEditor({ initial, onClose, onSaved, onDeleted }) {
  const { t, lang } = useT()
  const vehicles = useCollection('vehicles')
  const [f, setF] = useState({
    name: '', nickname: '', type: 'car', brand: '', model: '', year: '', color: '',
    plate: '', vin: '', mileage: '', fuel: '', purchaseDate: '', purchasePrice: '',
    currentValue: '', insuranceCompany: '', policyExpiry: '', bio: '', photo: '', photoPos: '50% 50%', ownership: 'owned', ...initial,
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const cameraRef = useRef()
  const fileRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isBoat = f.type === 'boat'

  // Cover-photo position (object-position), for readjusting the crop.
  const pos = (f.photoPos || '50% 50%').split(' ')
  const posX = parseInt(pos[0]) || 50
  const posY = parseInt(pos[1]) || 50
  const setPos = (x, y) => setF(prev => ({ ...prev, photoPos: `${x}% ${y}%` }))

  const onPhoto = async (fileList) => {
    const file = fileList && fileList[0]
    if (!file) return
    setBusy(true)
    try { const url = await imageToDataURL(file); if (url) setF(prev => ({ ...prev, photo: url })) }
    finally { setBusy(false) }
  }

  const submit = () => {
    if (!f.name.trim() && !f.model.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() || f.model.trim() }
    if (initial?.id) vehicles.save({ ...rec, id: initial.id })
    else vehicles.add(rec)
    onSaved && onSaved()
    onClose()
  }

  const doDelete = () => {
    if (!window.confirm(t('deleteVehicleQ'))) return
    vehicles.remove(initial.id)
    onClose()
    onDeleted && onDeleted()
  }

  return (
    <Sheet title={initial?.id ? t('edit') : t('addGarageItem')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial?.id && <Button block variant="danger" icon="trash" onClick={doDelete}>{t('delete')}</Button>}
      </div>}>
      {/* Photo */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          position: 'relative', height: 170, borderRadius: 'var(--r-lg)', overflow: 'hidden',
          border: '1px solid var(--line)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center',
        }}>
          {f.photo
            ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${posX}% ${posY}%` }} />
            : <Icon name="camera" size={34} stroke={1.4} style={{ color: 'var(--ink-3)' }} />}
          {busy && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.3)' }}><span className="spinner" style={{ width: 22, height: 22 }} /></div>}
          {f.photo && (
            <button onClick={() => setF({ ...f, photo: '' })} aria-label={t('delete')} style={{
              position: 'absolute', top: 8, insetInlineEnd: 8, width: 28, height: 28, borderRadius: '50%',
              border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'grid', placeItems: 'center',
            }}><Icon name="x" size={15} /></button>
          )}
        </div>
        <div className="row2" style={{ marginTop: 8 }}>
          <Button icon="camera" onClick={() => cameraRef.current?.click()}>{t('takePhoto')}</Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>{t('choosePhoto')}</Button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { onPhoto(e.target.files); e.target.value = '' }} />
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { onPhoto(e.target.files); e.target.value = '' }} />

        {f.photo && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span className="hint">{t('adjustPhoto')}</span>
              <button className="link-btn" type="button" onClick={() => setPos(50, 50)}>{t('reset')}</button>
            </div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('horizontal')}</label>
            <input type="range" min="0" max="100" value={posX} onChange={e => setPos(parseInt(e.target.value), posY)} style={{ width: '100%' }} />
            <label style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('vertical')}</label>
            <input type="range" min="0" max="100" value={posY} onChange={e => setPos(posX, parseInt(e.target.value))} style={{ width: '100%' }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="chip-row">
          {VEHICLE_TYPES.map(v => (
            <Chip key={v.id} selectable on={f.type === v.id} onClick={() => setF({ ...f, type: v.id })}>{t(v.key)}</Chip>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '0 2px 7px' }}>{t('ownership')}</label>
        <div className="chip-row">
          {OWNERSHIP_STATUSES.map(o => (
            <Chip key={o.id} selectable on={f.ownership === o.id} onClick={() => setF({ ...f, ownership: o.id })}>{label(o, lang)}</Chip>
          ))}
        </div>
      </div>
      <div className="row2">
        <Field label={t('vehicleName')} required error={err}><Input value={f.name} onChange={set('name')} /></Field>
        <Field label={t('nickname')}><Input value={f.nickname} onChange={set('nickname')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('brand')}><Input value={f.brand} onChange={set('brand')} /></Field>
        <Field label={t('model')}><Input value={f.model} onChange={set('model')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('modelYear')}><Input type="number" value={f.year} onChange={set('year')} /></Field>
        <Field label={t('color')}><Input value={f.color} onChange={set('color')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('plate')}><Input value={f.plate} onChange={set('plate')} /></Field>
        <Field label={isBoat ? t('engineHours') : t('mileage')}><Input value={f.mileage} onChange={set('mileage')} /></Field>
      </div>
      <Field label={t('vin')}><Input value={f.vin} onChange={set('vin')} /></Field>
      <div className="row2">
        <Field label={t('purchaseDate')}><Input type="date" value={f.purchaseDate} onChange={set('purchaseDate')} /></Field>
        <Field label={t('purchasePrice')}><Input type="number" value={f.purchasePrice} onChange={set('purchasePrice')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('currentValue')}><Input type="number" value={f.currentValue} onChange={set('currentValue')} /></Field>
        <Field label={t('insurance')}><Input value={f.insuranceCompany} onChange={set('insuranceCompany')} /></Field>
      </div>
      <Field label={t('policyExpiry')}><Input type="date" value={f.policyExpiry} onChange={set('policyExpiry')} /></Field>
      <Field label={t('biography')} hint={t('optional')}><TextArea value={f.bio} onChange={set('bio')} /></Field>
    </Sheet>
  )
}
