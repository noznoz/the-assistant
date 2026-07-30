import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { DetailHeader, Card, Section, Stat, Sheet, Field, Input, TextArea, Select, Chip, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { PROPERTY_TYPES, findPropertyType, OWNERSHIP_STATUSES, findOwnership, label } from '../../lib/domain.js'
import { money, toSar, fmtDate } from '../../lib/format.js'
import { imageToDataURL } from '../../lib/files.js'
import { share } from '../../lib/share.js'
import EntityDocuments from '../shared/EntityDocuments.jsx'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function PropertiesScreen({ param, go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const properties = useCollection('properties')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  if (param) {
    const p = properties.items.find(x => x.id === param)
    if (p) return <PropertyDetail property={p} go={go} onBack={() => go('properties')} />
  }

  const totalValue = properties.items.reduce((s, p) => s + toSar(p.currentValue || p.purchasePrice, p.currency || 'SAR', rates), 0)
  const monthlyRent = properties.items.reduce((s, p) => s + toSar(p.monthlyRent, p.currency || 'SAR', rates), 0)

  return (
    <>
      <TopBar title={t('properties')} sub={`${properties.items.length} ${t('properties').toLowerCase()}`} />
      <div className="screen">
        {properties.items.length === 0 ? (
          <Empty icon="doc" title={t('noProperties')} text={t('propertiesHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addProperty')}</Button>} />
        ) : (
          <>
            <Card style={{ textAlign: 'center', marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('portfolioValue')}</div>
              <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }} className="tnum">{money(totalValue, cur, lang)}</div>
              {monthlyRent > 0 && <div className="muted t-ok" style={{ fontSize: 12, marginTop: 4, fontWeight: 650 }}>+{money(monthlyRent, cur, lang)} {t('rentPerMonth')}</div>}
            </Card>
            <div style={{ marginTop: 14 }}>
              {properties.items.map(p => {
                const type = findPropertyType(p.type)
                const ow = findOwnership(p.ownership)
                const val = toSar(p.currentValue || p.purchasePrice, p.currency || 'SAR', rates)
                return (
                  <SwipeRow key={p.id} onEdit={() => setEditor(p)} onDelete={() => { properties.remove(p.id); toast.show(t('deletedToast')) }}>
                  <div className="veh-card" onClick={() => go(`properties/${p.id}`)}>
                    <div className="img">
                      {p.photo ? <img src={p.photo} alt={p.name} style={{ objectPosition: p.photoPos || '50% 50%' }} /> : <Icon name={type?.icon || 'doc'} size={56} stroke={1.4} />}
                      <div className="badge" style={{ display: 'flex', gap: 6 }}>
                        <Chip tint="t-brand">{type ? label(type, lang) : ''}</Chip>
                        {ow && ow.id !== 'owned' && <Chip tint={ow.tint}>{label(ow, lang)}</Chip>}
                      </div>
                    </div>
                    <div className="info">
                      <h3>{p.name}</h3>
                      <div className="sub">{p.address || ''}</div>
                      <div className="foot">
                        <span><b>{money(val, cur, lang)}</b></span>
                        {Number(p.monthlyRent) > 0 && <span className="t-ok">+{money(toSar(p.monthlyRent, p.currency || 'SAR', rates), cur, lang)}/{t('perMonth')}</span>}
                      </div>
                    </div>
                  </div>
                  </SwipeRow>
                )
              })}
            </div>
          </>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <PropertyEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function PropertyDetail({ property, go, onBack }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const [tab, setTab] = useState('overview')
  const [edit, setEdit] = useState(false)
  const toast = useToast()

  const type = findPropertyType(property.type)
  const ow = findOwnership(property.ownership)
  const val = toSar(property.currentValue || property.purchasePrice, property.currency || 'SAR', rates)
  const gain = (Number(property.currentValue) || 0) && (Number(property.purchasePrice) || 0)
    ? toSar(property.currentValue, property.currency, rates) - toSar(property.purchasePrice, property.currency, rates) : 0

  const shareCard = () => share([
    `🏠 *${property.name}*`, property.address || '',
    `${t('currentValue')}: ${money(val, cur, lang)}`,
    Number(property.monthlyRent) > 0 ? `${t('rentPerMonth')}: ${money(toSar(property.monthlyRent, property.currency || 'SAR', rates), cur, lang)}` : '',
  ].filter(Boolean).join('\n'))

  return (
    <>
      <DetailHeader title={property.name} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEdit(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        <div className="veh-card" style={{ marginTop: 14 }}>
          <div className="img">
            {property.photo ? <img src={property.photo} alt={property.name} style={{ objectPosition: property.photoPos || '50% 50%' }} /> : <Icon name={type?.icon || 'doc'} size={64} stroke={1.4} />}
            <div className="badge" style={{ display: 'flex', gap: 6 }}>
              <Chip tint="t-brand">{type ? label(type, lang) : ''}</Chip>
              {ow && <Chip tint={ow.tint}>{label(ow, lang)}</Chip>}
            </div>
          </div>
          <div className="info"><h3>{property.name}</h3><div className="sub">{property.address || ''}</div></div>
        </div>

        <div className="icontabs" style={{ margin: '14px 0' }}>
          {[{ id: 'overview', icon: 'grid', label: t('overview') }, { id: 'documents', icon: 'doc', label: t('documents') }].map(x => (
            <button key={x.id} className={`icontab ${tab === x.id ? 'on' : ''}`} onClick={() => setTab(x.id)} aria-label={x.label}>
              <Icon name={x.icon} size={20} stroke={tab === x.id ? 2.3 : 1.9} /><span className="cap">{x.label}</span>
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <Card style={{ textAlign: 'center', marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('currentValue')}</div>
              <div style={{ fontSize: 30, fontWeight: 780, marginTop: 4 }} className="tnum">{money(val, cur, lang)}</div>
              {gain !== 0 && <div className={`muted ${gain >= 0 ? 't-ok' : 't-danger'}`} style={{ fontSize: 13, marginTop: 2, fontWeight: 650 }}>{gain >= 0 ? '▲' : '▼'} {money(Math.abs(gain), cur, lang)}</div>}
            </Card>
            <Card className="stack">
              <Row k={t('type')} v={type ? label(type, lang) : ''} />
              <Row k={t('ownership')} v={ow ? label(ow, lang) : ''} />
              <Row k={t('address')} v={property.address} />
              <Row k={t('purchasePrice')} v={property.purchasePrice ? money(toSar(property.purchasePrice, property.currency || 'SAR', rates), cur, lang) : ''} />
              <Row k={t('rentPerMonth')} v={property.monthlyRent ? money(toSar(property.monthlyRent, property.currency || 'SAR', rates), cur, lang) : ''} />
              <Row k={t('rentedTo')} v={property.rentedTo} />
            </Card>
            {property.note && <Card style={{ marginTop: 12 }}><p style={{ color: 'var(--ink-2)' }}>{property.note}</p></Card>}
            <Button block variant="brand" icon="whatsapp" style={{ marginTop: 14 }} onClick={shareCard}>{t('share')}</Button>
          </>
        )}

        {tab === 'documents' && <EntityDocuments filterKey="propertyId" id={property.id} hint={t('propertyDocsHint')} />}
      </div>
      {edit && <PropertyEditor initial={property} onClose={() => setEdit(false)} onSaved={() => toast.show(t('savedToast'))} onDeleted={onBack} />}
      {toast.node}
    </>
  )
}

function Row({ k, v }) {
  if (!v) return null
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}><span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'end' }}>{v}</span></div>
}

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

function PropertyEditor({ initial, onClose, onSaved, onDeleted }) {
  const { t, lang } = useT()
  const properties = useCollection('properties')
  const [f, setF] = useState({ name: '', type: 'villa', address: '', purchasePrice: '', currentValue: '', currency: 'SAR', monthlyRent: '', rentedTo: '', ownership: 'owned', note: '', photo: '', photoPos: '50% 50%', ...initial })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const onPhoto = async (fl) => { const file = fl && fl[0]; if (!file) return; setBusy(true); try { const u = await imageToDataURL(file); if (u) setF(p => ({ ...p, photo: u })) } finally { setBusy(false) } }

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), purchasePrice: parseFloat(f.purchasePrice) || 0, currentValue: parseFloat(f.currentValue) || 0, monthlyRent: parseFloat(f.monthlyRent) || 0 }
    initial.id ? properties.save({ ...rec, id: initial.id }) : properties.add(rec)
    onSaved && onSaved(); onClose()
  }

  return (
    <Sheet title={initial.id ? t('editProperty') : t('addProperty')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { properties.remove(initial.id); onClose(); onDeleted && onDeleted() }}>{t('delete')}</Button>}
      </div>}>
      <div style={{ position: 'relative', height: 150, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>
        {f.photo ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={30} style={{ color: 'var(--ink-3)' }} />}
        {busy && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.3)' }}><span className="spinner" style={{ width: 20, height: 20 }} /></div>}
        {f.photo && <button onClick={() => setF({ ...f, photo: '' })} aria-label={t('delete')} style={{ position: 'absolute', top: 8, insetInlineEnd: 8, width: 26, height: 26, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="x" size={14} /></button>}
      </div>
      <Button block icon="camera" onClick={() => fileRef.current?.click()} style={{ marginBottom: 12 }}>{t('choosePhoto')}</Button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { onPhoto(e.target.files); e.target.value = '' }} />

      <Field label={t('propertyName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Villa, Rental flat…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('type')}><Select value={f.type} onChange={set('type')} options={PROPERTY_TYPES.map(s => ({ value: s.id, label: label(s, lang) }))} /></Field>
        <Field label={t('ownership')}><Select value={f.ownership} onChange={set('ownership')} options={OWNERSHIP_STATUSES.map(s => ({ value: s.id, label: label(s, lang) }))} /></Field>
      </div>
      <Field label={t('address')}><Input value={f.address} onChange={set('address')} placeholder="District, city" /></Field>
      <div className="row2">
        <Field label={t('purchasePrice')}><Input type="number" inputMode="decimal" value={f.purchasePrice} onChange={set('purchasePrice')} placeholder="0" /></Field>
        <Field label={t('currentValue')}><Input type="number" inputMode="decimal" value={f.currentValue} onChange={set('currentValue')} placeholder="0" /></Field>
      </div>
      <div className="row2">
        <Field label={t('rentPerMonth')}><Input type="number" inputMode="decimal" value={f.monthlyRent} onChange={set('monthlyRent')} placeholder="0" /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <Field label={t('rentedTo')} hint={t('optional')}><Input value={f.rentedTo} onChange={set('rentedTo')} /></Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
