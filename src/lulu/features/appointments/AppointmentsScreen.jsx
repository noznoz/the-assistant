import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Sheet, Field, Input, TextArea, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { APPOINTMENT_TYPES, findAppointmentType, label } from '../../lib/domain.js'
import { fmtDate, fmtTime, relativeDay, daysUntil, todayISO } from '../../lib/format.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function AppointmentsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const appts = useCollection('appointments')
  const people = useCollection('people')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const nameFor = (id) => (people.items.find(p => p.id === id) || {}).name
  const sorted = appts.items.slice().sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`))
  const today = todayISO()
  const upcoming = sorted.filter(a => (a.date || '') >= today)
  const past = sorted.filter(a => (a.date || '') < today).reverse()

  const row = (a) => {
    const type = findAppointmentType(a.type)
    const dd = daysUntil(a.date)
    const who = nameFor(a.personId)
    return (
      <SwipeRow key={a.id} onEdit={() => setEditor(a)} onDelete={() => { appts.remove(a.id); toast.show(t('deletedToast')) }}>
        <div className="li" onClick={() => setEditor(a)}>
          <div className={`lead ${dd != null && dd >= 0 && dd <= 3 ? 't-warn' : 't-brand'}`}><Icon name={type?.icon || 'calendar'} size={18} /></div>
          <div className="body">
            <div className="title">{a.title}{who ? ` · ${who}` : ''}</div>
            <div className="meta">
              {type ? label(type, lang) : ''}
              {a.date && <span>· {fmtDate(a.date, lang, settings.dateFormat)}{a.time ? ` ${fmtTime(a.time, lang)}` : ''}</span>}
              {a.location && <span>· {a.location}</span>}
            </div>
          </div>
          {a.date && dd != null && dd >= 0 && <Chip tint={dd <= 3 ? 't-warn' : 't-info'}>{relativeDay(a.date, lang)}</Chip>}
        </div>
      </SwipeRow>
    )
  }

  return (
    <>
      <DetailHeader title={t('appointments')} onBack={() => go('more')} />
      <div className="screen">
        {appts.items.length === 0 ? (
          <Empty icon="calendar" title={t('noAppointments')} text={t('appointmentsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addAppointment')}</Button>} />
        ) : (
          <>
            {upcoming.length > 0 && <><Section title={t('upcoming')} count={upcoming.length} /><Card tight>{upcoming.map(row)}</Card></>}
            {past.length > 0 && <><Section title={t('past')} count={past.length} /><Card tight style={{ opacity: 0.7 }}>{past.slice(0, 20).map(row)}</Card></>}
          </>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <ApptEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function ApptEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const appts = useCollection('appointments')
  const people = useCollection('people')
  const [f, setF] = useState({ title: '', type: 'doctor', personId: '', date: todayISO(), time: '', location: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.title.trim()) { setErr(t('required')); return }
    const rec = { ...f, title: f.title.trim() }
    initial.id ? appts.save({ ...rec, id: initial.id }) : appts.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editAppointment') : t('addAppointment')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { appts.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('appointmentTitle')} required error={err}><Input value={f.title} onChange={set('title')} placeholder={t('appointmentPlaceholder')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('type')}><Select value={f.type} onChange={set('type')} options={APPOINTMENT_TYPES.map(x => ({ value: x.id, label: label(x, lang) }))} /></Field>
        <Field label={t('who')} hint={t('optional')}>
          <Select value={f.personId} onChange={set('personId')}>
            <option value="">{t('none')}</option>
            {people.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="row2">
        <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label={t('time')} hint={t('optional')}><Input type="time" value={f.time} onChange={set('time')} /></Field>
      </div>
      <Field label={t('location')} hint={t('optional')}><Input value={f.location} onChange={set('location')} placeholder={t('locationPlaceholder')} /></Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
