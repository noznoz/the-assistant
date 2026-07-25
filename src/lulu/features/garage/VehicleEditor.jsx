import React, { useState } from 'react'
import { Sheet, Field, Input, TextArea, Select, Button, Chip } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { VEHICLE_TYPES } from '../../lib/domain.js'

export default function VehicleEditor({ initial, onClose, onSaved }) {
  const { t } = useT()
  const vehicles = useCollection('vehicles')
  const [f, setF] = useState({
    name: '', nickname: '', type: 'car', brand: '', model: '', year: '', color: '',
    plate: '', vin: '', mileage: '', fuel: '', purchaseDate: '', purchasePrice: '',
    currentValue: '', insuranceCompany: '', policyExpiry: '', bio: '', ...initial,
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isBoat = f.type === 'boat'

  const submit = () => {
    if (!f.name.trim() && !f.model.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() || f.model.trim() }
    if (initial?.id) vehicles.save({ ...rec, id: initial.id })
    else vehicles.add(rec)
    onSaved && onSaved()
    onClose()
  }

  return (
    <Sheet title={initial?.id ? t('edit') : t('addGarageItem')} onClose={onClose}
      footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <div style={{ marginBottom: 16 }}>
        <div className="chip-row">
          {VEHICLE_TYPES.map(v => (
            <Chip key={v.id} selectable on={f.type === v.id} onClick={() => setF({ ...f, type: v.id })}>{t(v.key)}</Chip>
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
