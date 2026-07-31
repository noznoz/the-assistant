import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Section, Sheet, Field, Input, TextArea, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { fmtLongDate, fmtTime } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

// Day-by-day itinerary for a trip. Entries carry a date + optional time and are
// grouped by day, sorted chronologically.
export default function TripItinerary({ trip }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const itinerary = useCollection('itinerary')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const mine = itinerary.items.filter(x => x.tripId === trip.id)
    .sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`))
  const days = {}
  mine.forEach(x => { (days[x.date || 'nd'] = days[x.date || 'nd'] || []).push(x) })
  const dayKeys = Object.keys(days).sort()

  return (
    <>
      {mine.length === 0 ? (
        <Empty icon="calendar" title={t('noItinerary')} text={t('itineraryHint')}
          action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addPlan')}</Button>} />
      ) : dayKeys.map(dk => (
        <React.Fragment key={dk}>
          <Section title={dk === 'nd' ? t('unscheduled') : fmtLongDate(dk, lang)} count={days[dk].length} />
          <Card tight>
            {days[dk].map(x => (
              <SwipeRow key={x.id} onEdit={() => setEditor(x)} onDelete={() => { itinerary.remove(x.id); toast.show(t('deletedToast')) }}>
                <div className="li" onClick={() => setEditor(x)}>
                  <div className="lead t-brand" style={{ minWidth: 52, fontSize: 12, fontWeight: 700 }}>{x.time ? fmtTime(x.time, lang) : '—'}</div>
                  <div className="body">
                    <div className="title">{x.title}</div>
                    {x.note && <div className="meta">{x.note}</div>}
                  </div>
                </div>
              </SwipeRow>
            ))}
          </Card>
        </React.Fragment>
      ))}
      <Fab onClick={() => setEditor({})} />
      {editor && <PlanEditor tripId={trip.id} tripStart={trip.start} initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function PlanEditor({ tripId, tripStart, initial, onClose, onSaved }) {
  const { t } = useT()
  const itinerary = useCollection('itinerary')
  const [f, setF] = useState({ tripId, date: tripStart || '', time: '', title: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.title.trim()) { setErr(t('required')); return }
    const rec = { ...f, title: f.title.trim() }
    initial.id ? itinerary.save({ ...rec, id: initial.id }) : itinerary.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('edit') : t('addPlan')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { itinerary.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('appointmentTitle')} required error={err}><Input value={f.title} onChange={set('title')} placeholder={t('planPlaceholder')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label={t('time')} hint={t('optional')}><Input type="time" value={f.time} onChange={set('time')} /></Field>
      </div>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
