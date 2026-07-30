import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Fab, Chip, Empty, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { findVehicleType, VEHICLE_TYPES, findOwnership, label } from '../../lib/domain.js'
import { money, daysUntil } from '../../lib/format.js'
import VehicleEditor from './VehicleEditor.jsx'
import VehicleProfile from './VehicleProfile.jsx'

export default function GarageScreen({ param, go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const vehicles = useCollection('vehicles')
  const [editor, setEditor] = useState(false)
  const [filter, setFilter] = useState('all')
  const toast = useToast()

  if (param) {
    const v = vehicles.items.find(x => x.id === param)
    if (v) return <VehicleProfile vehicle={v} go={go} onBack={() => go('garage')} />
  }

  const list = filter === 'all' ? vehicles.items : vehicles.items.filter(v => v.type === filter)

  return (
    <>
      <TopBar title={t('myGarage')} sub={`${vehicles.items.length} ${lang === 'ar' ? 'مركبات' : 'vehicles'}`} />
      <div className="screen">
        {vehicles.items.length === 0 ? (
          <Empty icon="car" title={t('nothingHere')} text={t('addGarageItem')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor(true)}>{t('addGarageItem')}</Button>} />
        ) : (
          <>
            <div className="chip-row" style={{ margin: '14px 0 4px' }}>
              <Chip selectable on={filter === 'all'} onClick={() => setFilter('all')}>{t('all')}</Chip>
              {VEHICLE_TYPES.map(vt => (
                <Chip key={vt.id} selectable on={filter === vt.id} onClick={() => setFilter(vt.id)}>{t(vt.key)}</Chip>
              ))}
            </div>
            {list.map(v => <VehicleCard key={v.id} v={v} lang={lang} cur={settings.currency} onClick={() => go(`garage/${v.id}`)} />)}
          </>
        )}
      </div>
      <Fab onClick={() => setEditor(true)} />
      {editor && <VehicleEditor onClose={() => setEditor(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function VehicleCard({ v, lang, cur, onClick }) {
  const { t } = useT()
  const vt = findVehicleType(v.type)
  const dd = daysUntil(v.policyExpiry)
  return (
    <div className="veh-card" onClick={onClick}>
      <div className="img">
        {v.photo ? <img src={v.photo} alt={v.name} style={{ objectPosition: v.photoPos || '50% 50%' }} /> : <Icon name={vt?.icon || 'car'} size={64} stroke={1.4} />}
        <div className="badge" style={{ display: 'flex', gap: 6 }}>
          <Chip tint="t-brand">{vt ? t(vt.key) : ''}</Chip>
          {(() => { const ow = findOwnership(v.ownership); return ow && ow.id !== 'owned' ? <Chip tint={ow.tint}>{label(ow, lang)}</Chip> : null })()}
        </div>
        {dd != null && dd <= 30 && (
          <div style={{ position: 'absolute', top: 12, insetInlineEnd: 12 }}>
            <Chip tint={dd <= 14 ? 't-danger' : 't-warn'}><Icon name="shield" size={12} /> {dd}d</Chip>
          </div>
        )}
      </div>
      <div className="info">
        <h3>{v.name}</h3>
        <div className="sub">{v.nickname ? `“${v.nickname}” · ` : ''}{[v.brand, v.model, v.year].filter(Boolean).join(' · ')}</div>
        <div className="foot">
          {v.mileage && <span><Icon name="gauge" size={14} /> <b>{v.mileage}</b></span>}
          {v.currentValue && <span>{t('currentValue')}: <b>{money(v.currentValue, cur, lang)}</b></span>}
        </div>
      </div>
    </div>
  )
}
