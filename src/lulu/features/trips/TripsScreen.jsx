import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Sheet, Field, Input, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { fmtDate } from '../../lib/format.js'
import { share } from '../../lib/share.js'

export default function TripsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const trips = useCollection('trips')
  const vehicles = useCollection('vehicles')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const shareTrip = (trip) => {
    const veh = vehicles.items.find(v => v.id === trip.vehicleId)
    share([`🧭 *${trip.name}*`, trip.destination ? `📍 ${trip.destination}` : '',
      trip.start ? `${fmtDate(trip.start, lang, settings.dateFormat)} → ${fmtDate(trip.end, lang, settings.dateFormat)}` : '',
      veh ? `🚗 ${veh.name}` : '', '', '— The Assistant'].filter(Boolean).join('\n'))
  }

  return (
    <>
      <DetailHeader title={t('trips')} onBack={() => go('more')} />
      <div className="screen">
        {trips.items.length === 0 ? (
          <Empty icon="trip" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('add')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {trips.items.map(tr => (
              <div className="li" key={tr.id} onClick={() => setEditor(tr)}>
                <div className="lead t-brand"><Icon name="trip" size={18} /></div>
                <div className="body">
                  <div className="title">{tr.name}</div>
                  <div className="meta">{tr.destination}{tr.start ? ` · ${fmtDate(tr.start, lang, settings.dateFormat)}` : ''}</div>
                </div>
                <button className="iconbtn" style={{ color: 'var(--ok)' }} onClick={e => { e.stopPropagation(); shareTrip(tr) }}><Icon name="whatsapp" size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <TripEditor initial={editor.id ? editor : {}} vehicles={vehicles.items} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function TripEditor({ initial, vehicles, onClose, onSaved }) {
  const { t } = useT()
  const trips = useCollection('trips')
  const [f, setF] = useState({ name: '', destination: '', start: '', end: '', vehicleId: '', notes: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => { if (!f.name.trim()) return; initial.id ? trips.save({ ...f, id: initial.id }) : trips.add(f); onSaved && onSaved(); onClose() }
  return (
    <Sheet title={initial.id ? t('edit') : t('trips')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { trips.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('title')} required><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label="Destination"><Input value={f.destination} onChange={set('destination')} placeholder="Destination" /></Field>
      <div className="row2">
        <Field label="Start"><Input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="End"><Input type="date" value={f.end} onChange={set('end')} /></Field>
      </div>
      {vehicles.length > 0 && (
        <Field label={t('relatedVehicle')}>
          <Select value={f.vehicleId} onChange={set('vehicleId')}>
            <option value="">{t('none')}</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t('notesField')}><Input value={f.notes} onChange={set('notes')} /></Field>
    </Sheet>
  )
}
