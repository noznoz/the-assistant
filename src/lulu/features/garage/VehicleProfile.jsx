import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Segmented, Card, Section, Button, Sheet, Field, Input, Chip, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { findVehicleType } from '../../lib/domain.js'
import { money, fmtDate, daysUntil } from '../../lib/format.js'
import { share, formatVehicle } from '../../lib/share.js'
import VehicleEditor from './VehicleEditor.jsx'

export default function VehicleProfile({ vehicle, go, onBack }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const services = useCollection('services')
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const [tab, setTab] = useState('overview')
  const [edit, setEdit] = useState(false)
  const [svcEditor, setSvcEditor] = useState(false)
  const toast = useToast()

  const vt = findVehicleType(vehicle.type)
  const isBoat = vehicle.type === 'boat'
  const myServices = services.items.filter(s => s.vehicleId === vehicle.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const myExpenses = expenses.items.filter(e => e.relatedVehicle === vehicle.id)
  const totalCost = myExpenses.reduce((s, e) => s + (+e.amount || 0), 0)
  const dd = daysUntil(vehicle.policyExpiry)

  return (
    <>
      <DetailHeader title={vehicle.nickname || vehicle.name} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEdit(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        <div className="veh-card" style={{ marginTop: 14 }}>
          <div className="img">
            {vehicle.photo ? <img src={vehicle.photo} alt={vehicle.name} /> : <Icon name={vt?.icon || 'car'} size={72} stroke={1.4} />}
            <div className="badge"><Chip tint="t-brand">{vt ? t(vt.key) : ''}</Chip></div>
          </div>
          <div className="info">
            <h3>{vehicle.name}</h3>
            <div className="sub">{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' · ')}</div>
          </div>
        </div>

        <div style={{ margin: '14px 0' }}>
          <Segmented value={tab} onChange={setTab} options={[
            { value: 'overview', label: t('overview') },
            { value: 'maintenance', label: t('maintenance') },
            { value: 'expenses', label: t('vehExpenses') },
          ]} />
        </div>

        {tab === 'overview' && (
          <>
            {vehicle.bio && <Card style={{ marginBottom: 14 }}><p style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>“{vehicle.bio}”</p></Card>}
            <Card className="stack">
              <Row k={t('brand')} v={vehicle.brand} />
              <Row k={t('model')} v={vehicle.model} />
              <Row k={t('modelYear')} v={vehicle.year} />
              <Row k={t('color')} v={vehicle.color} />
              <Row k={t('plate')} v={vehicle.plate} />
              <Row k={t('vin')} v={vehicle.vin} />
              <Row k={isBoat ? t('engineHours') : t('mileage')} v={vehicle.mileage} />
              <Row k={t('purchasePrice')} v={vehicle.purchasePrice ? money(vehicle.purchasePrice, cur, lang) : ''} />
              <Row k={t('currentValue')} v={vehicle.currentValue ? money(vehicle.currentValue, cur, lang) : ''} />
            </Card>

            {vehicle.policyExpiry && (
              <Card style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`lead ${dd <= 14 ? 't-danger' : dd <= 45 ? 't-warn' : 't-ok'}`} style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center' }}>
                  <Icon name="shield" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 650 }}>{t('insurance')} · {vehicle.insuranceCompany}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{t('policyExpiry')}: {fmtDate(vehicle.policyExpiry, lang, settings.dateFormat)}</div>
                </div>
                {dd != null && <Chip tint={dd <= 14 ? 't-danger' : dd <= 45 ? 't-warn' : 't-ok'}>{dd}d</Chip>}
              </Card>
            )}

            <Button block variant="brand" icon="whatsapp" style={{ marginTop: 16 }}
              onClick={() => share(formatVehicle(vehicle, lang, settings))}>{t('shareWhatsApp')}</Button>
          </>
        )}

        {tab === 'maintenance' && (
          <>
            <Section title={t('maintenance')} count={myServices.length}
              action={t('add')} onAction={() => setSvcEditor(true)} />
            {myServices.length === 0 ? (
              <Empty icon="wrench" title={t('nothingHere')}
                action={<Button variant="primary" icon="plus" onClick={() => setSvcEditor(true)}>{t('addService')}</Button>} />
            ) : myServices.map(s => (
              <div className="li" key={s.id}>
                <div className="lead t-brand"><Icon name="wrench" size={18} /></div>
                <div className="body">
                  <div className="title">{s.work}</div>
                  <div className="meta">{fmtDate(s.date, lang, settings.dateFormat)} · {s.workshop} {s.odo ? `· ${s.odo}` : ''}</div>
                  {s.nextDate && <div className="meta t-warn" style={{ padding: '1px 6px', borderRadius: 6, marginTop: 4 }}>{t('nextService')}: {fmtDate(s.nextDate, lang, settings.dateFormat)}</div>}
                </div>
                {s.cost ? <b className="tnum">{money(s.cost, cur, lang)}</b> : null}
              </div>
            ))}
          </>
        )}

        {tab === 'expenses' && (
          <>
            <Card style={{ textAlign: 'center', marginBottom: 14 }}>
              <div className="k muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('totalCost')}</div>
              <div style={{ fontSize: 30, fontWeight: 750, marginTop: 4 }} className="tnum">{money(totalCost, cur, lang)}</div>
            </Card>
            {myExpenses.length === 0 ? <Empty icon="wallet" title={t('nothingHere')} /> :
              myExpenses.map(e => (
                <div className="li" key={e.id}>
                  <div className="lead t-ok"><Icon name="wallet" size={18} /></div>
                  <div className="body">
                    <div className="title">{e.merchant || t('vehExpenses')}</div>
                    <div className="meta">{fmtDate(e.date, lang, settings.dateFormat)}</div>
                  </div>
                  <b className="tnum">{money(e.amount, cur, lang)}</b>
                </div>
              ))}
          </>
        )}
      </div>

      {edit && <VehicleEditor initial={vehicle} onClose={() => setEdit(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {svcEditor && <ServiceEditor vehicleId={vehicle.id} onClose={() => setSvcEditor(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function Row({ k, v }) {
  if (!v) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
      <span className="muted">{k}</span>
      <span style={{ fontWeight: 600, textAlign: 'end' }}>{v}</span>
    </div>
  )
}

function ServiceEditor({ vehicleId, onClose, onSaved }) {
  const { t } = useT()
  const services = useCollection('services')
  const [f, setF] = useState({ vehicleId, date: new Date().toISOString().slice(0, 10), odo: '', workshop: '', work: '', cost: '', nextDate: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => { if (!f.work.trim()) return; services.add({ ...f, cost: parseFloat(f.cost) || 0 }); onSaved && onSaved(); onClose() }
  return (
    <Sheet title={t('addService')} onClose={onClose} footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <Field label={t('maintenance')} required><Input value={f.work} onChange={set('work')} placeholder="e.g. Oil & filter" autoFocus /></Field>
      <div className="row2">
        <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label={t('mileage')}><Input value={f.odo} onChange={set('odo')} /></Field>
      </div>
      <Field label="Workshop"><Input value={f.workshop} onChange={set('workshop')} /></Field>
      <div className="row2">
        <Field label={t('totalCost')}><Input type="number" value={f.cost} onChange={set('cost')} /></Field>
        <Field label={t('nextService')}><Input type="date" value={f.nextDate} onChange={set('nextDate')} /></Field>
      </div>
    </Sheet>
  )
}
