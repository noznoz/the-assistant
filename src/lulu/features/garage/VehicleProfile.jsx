import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Segmented, Card, Section, Stat, Button, Sheet, Field, Input, Chip, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { findVehicleType } from '../../lib/domain.js'
import { money, fmtDate, daysUntil, expenseSar } from '../../lib/format.js'
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
  const [emergency, setEmergency] = useState(false)
  const toast = useToast()

  const vt = findVehicleType(vehicle.type)
  const isBoat = vehicle.type === 'boat'
  const myServices = services.items.filter(s => s.vehicleId === vehicle.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const myExpenses = expenses.items.filter(e => e.relatedVehicle === vehicle.id)
  const totalCost = myExpenses.reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const dd = daysUntil(vehicle.policyExpiry)

  const parseKm = (s) => { const n = parseFloat(String(s || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n }
  const currentKm = parseKm(vehicle.mileage)

  // Service due — by date (<=30d) or by mileage (within 1000 km of next odo).
  const serviceDue = myServices.map(s => {
    const dDate = daysUntil(s.nextDate)
    const nextKm = parseKm(s.nextOdo)
    const kmLeft = (nextKm != null && currentKm != null) ? nextKm - currentKm : null
    const due = (dDate != null && dDate <= 30) || (kmLeft != null && kmLeft <= 1000)
    return { s, dDate, kmLeft, due }
  }).filter(x => x.due).sort((a, b) => (a.dDate ?? 999) - (b.dDate ?? 999))

  // Fuel economy from consecutive fill-ups that recorded an odometer.
  const fuelExp = myExpenses.filter(e => e.category === 'fuel').sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const fuelTotal = fuelExp.reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const withOdo = fuelExp.filter(e => parseKm(e.odometer) != null)
  let distance = 0, litersForDist = 0, costForDist = 0
  for (let i = 1; i < withOdo.length; i++) {
    const dkm = parseKm(withOdo[i].odometer) - parseKm(withOdo[i - 1].odometer)
    if (dkm > 0) { distance += dkm; litersForDist += parseFloat(withOdo[i].liters) || 0; costForDist += expenseSar(withOdo[i], settings.rates) }
  }
  const consumption = distance > 0 && litersForDist > 0 ? (litersForDist / distance * 100) : null
  const costPerKm = distance > 0 && costForDist > 0 ? (costForDist / distance) : null

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
            { value: 'fuel', label: t('fuelLog') },
            { value: 'expenses', label: t('vehExpenses') },
          ]} />
        </div>

        {tab === 'overview' && (
          <>
            {serviceDue.length > 0 && (
              <Card style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="lead t-warn" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="wrench" size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{t('serviceDue')}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {serviceDue[0].s.work}
                    {serviceDue[0].dDate != null ? ` · ${fmtDate(serviceDue[0].s.nextDate, lang, settings.dateFormat)}` : ''}
                    {serviceDue[0].kmLeft != null ? ` · ${serviceDue[0].kmLeft <= 0 ? t('serviceDue') : `${Math.round(serviceDue[0].kmLeft)} km`}` : ''}
                  </div>
                </div>
                <button className="btn sm" onClick={() => setTab('maintenance')}>{t('view')}</button>
              </Card>
            )}
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

            <div className="row2" style={{ marginTop: 16 }}>
              <Button icon="shield" onClick={() => setEmergency(true)}>{t('showEmergency')}</Button>
              <Button variant="brand" icon="whatsapp" onClick={() => share(formatVehicle(vehicle, lang, settings))}>{t('share')}</Button>
            </div>
          </>
        )}

        {tab === 'fuel' && (
          <>
            <div className="stat-grid">
              <Stat label={t('totalFuel')} value={money(fuelTotal, cur, lang)} sub={`· ${fuelExp.length} ${t('fills')}`} />
              <Stat label={t('economy')} value={consumption ? consumption.toFixed(1) : '—'} sub={consumption ? t('consumption') : ''} />
            </div>
            {costPerKm != null && (
              <Card style={{ marginTop: 12, textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('costPerKm')}</div>
                <div style={{ fontSize: 26, fontWeight: 750, marginTop: 4 }} className="tnum">{money(costPerKm, cur, lang)}</div>
              </Card>
            )}
            <Section title={t('fuelLog')} count={fuelExp.length} action={t('add')} onAction={() => go('expenses')} />
            {fuelExp.length === 0 ? (
              <Empty icon="fuel" title={t('nothingHere')} text={t('addFiles')} />
            ) : [...fuelExp].reverse().map(e => (
              <div className="li" key={e.id}>
                <div className="lead t-brand"><Icon name="fuel" size={18} /></div>
                <div className="body">
                  <div className="title">{money(e.amount, e.currency || cur, lang)}</div>
                  <div className="meta">{fmtDate(e.date, lang, settings.dateFormat)}{e.liters ? ` · ${e.liters} ${t('liters')}` : ''}{e.odometer ? ` · ${e.odometer} km` : ''}</div>
                </div>
              </div>
            ))}
            <p className="hint center" style={{ marginTop: 12 }}>{t('liters')} + {t('odometer')} → {t('economy')}</p>
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

      {edit && <VehicleEditor initial={vehicle} onClose={() => setEdit(false)} onSaved={() => toast.show(t('savedToast'))} onDeleted={() => (onBack ? onBack() : go('garage'))} />}
      {svcEditor && <ServiceEditor vehicleId={vehicle.id} onClose={() => setSvcEditor(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {emergency && (
        <Sheet title={t('emergencyInfo')} onClose={() => setEmergency(false)}
          footer={<Button block variant="brand" icon="whatsapp" onClick={() => share(formatVehicle(vehicle, lang, settings))}>{t('share')}</Button>}>
          <div className="stack">
            <EmRow k={t('vehicleName')} v={vehicle.name} big />
            <EmRow k={t('plate')} v={vehicle.plate} big />
            <EmRow k={t('vin')} v={vehicle.vin} />
            <EmRow k={t('insurance')} v={vehicle.insuranceCompany} />
            <EmRow k={t('policyExpiry')} v={vehicle.policyExpiry ? fmtDate(vehicle.policyExpiry, lang, settings.dateFormat) : ''} />
            <EmRow k={isBoat ? t('engineHours') : t('mileage')} v={vehicle.mileage} />
          </div>
        </Sheet>
      )}
      {toast.node}
    </>
  )
}

function EmRow({ k, v, big }) {
  if (!v) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>{k}</span>
      <span style={{ fontWeight: big ? 750 : 600, fontSize: big ? 18 : 14, textAlign: 'end' }}>{v}</span>
    </div>
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
