import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Sheet, Field, Input, TextArea, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { fmtDate, fmtLongDate, todayISO } from '../../lib/format.js'
import { share, emailShare } from '../../lib/share.js'
import { uid } from '../../store/db.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

// Meeting notes with action items that convert into work tasks.
export default function MeetingsScreen({ param, go }) {
  const meetings = useCollection('meetings')
  if (param) {
    const m = meetings.items.find(x => x.id === param)
    if (m) return <MeetingDetail meeting={m} go={go} onBack={() => go('meetings')} />
  }
  return <MeetingsList go={go} />
}

function MeetingsList({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const meetings = useCollection('meetings')
  const [editor, setEditor] = useState(null)
  const toast = useToast()
  const sorted = meetings.items.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <>
      <DetailHeader title={t('meetings')} onBack={() => go('work')} />
      <div className="screen">
        {meetings.items.length === 0 ? (
          <Empty icon="note" title={t('noMeetings')} text={t('meetingsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addMeeting')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {sorted.map(m => {
              const open = (m.actions || []).filter(a => !a.taskId).length
              return (
                <SwipeRow key={m.id} onEdit={() => setEditor(m)} onDelete={() => { meetings.remove(m.id); toast.show(t('deletedToast')) }}>
                  <div className="li" onClick={() => go(`meetings/${m.id}`)}>
                    <div className="lead t-brand"><Icon name="note" size={18} /></div>
                    <div className="body">
                      <div className="title">{m.title}</div>
                      <div className="meta">{m.date ? fmtDate(m.date, lang, settings.dateFormat) : ''}{m.attendees ? ` · ${m.attendees}` : ''}{(m.actions || []).length ? ` · ${(m.actions || []).length} ${t('actionItems')}` : ''}</div>
                    </div>
                    {open > 0 && <span className="chip t-warn">{open}</span>}
                  </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <MeetingEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function MeetingDetail({ meeting, go, onBack }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const meetings = useCollection('meetings')
  const tasks = useCollection('tasks')
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState('')
  const toast = useToast()

  const actions = meeting.actions || []
  const save = (next) => meetings.save({ ...meeting, actions: next })
  const addAction = () => { const v = text.trim(); if (!v) return; save([...actions, { id: uid(), text: v }]); setText('') }
  const removeAction = (id) => save(actions.filter(a => a.id !== id))
  const toTask = (a) => {
    const rec = tasks.add({ title: a.text, classification: 'work', departmentId: meeting.departmentId || '', status: 'new', priority: 'medium', meetingId: meeting.id })
    save(actions.map(x => x.id === a.id ? { ...x, taskId: rec.id } : x))
    toast.show(t('taskCreated'))
  }

  const asText = () => {
    const lines = [`📝 *${meeting.title}*`, meeting.date ? fmtLongDate(meeting.date, lang) : '', meeting.attendees ? `${t('attendees')}: ${meeting.attendees}` : '', '']
    if (meeting.notes) lines.push(meeting.notes, '')
    if (actions.length) { lines.push(`${t('actionItems')}:`); actions.forEach(a => lines.push(`• ${a.text}`)) }
    lines.push('', '— The Assistant')
    return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')
  }

  return (
    <>
      <DetailHeader title={meeting.title} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEdit(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        <Card style={{ marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 13 }}>{meeting.date ? fmtLongDate(meeting.date, lang) : ''}{meeting.attendees ? ` · ${meeting.attendees}` : ''}</div>
          {meeting.notes && <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{meeting.notes}</p>}
        </Card>

        <Section title={t('actionItems')} count={actions.length} />
        {actions.map(a => (
          <div className="li" key={a.id}>
            <div className={`lead ${a.taskId ? 't-ok' : 't-warn'}`}><Icon name={a.taskId ? 'check' : 'flag'} size={17} /></div>
            <div className="body"><div className="title">{a.text}</div>{a.taskId && <div className="meta t-ok">{t('taskCreated')}</div>}</div>
            {a.taskId
              ? <button className="iconbtn" aria-label={t('delete')} onClick={() => removeAction(a.id)}><Icon name="x" size={15} /></button>
              : <button className="btn sm" onClick={() => toTask(a)}><Icon name="plus" size={13} /> {t('toTask')}</button>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Input value={text} onChange={e => setText(e.target.value)} placeholder={t('addActionItem')} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAction() } }} style={{ flex: 1 }} />
          <Button icon="plus" onClick={addAction}>{t('add')}</Button>
        </div>

        <div className="row2" style={{ marginTop: 16 }}>
          <Button variant="brand" icon="whatsapp" onClick={() => share(asText())}>{t('share')}</Button>
          <Button icon="mail" onClick={() => emailShare(meeting.title, asText())}>{t('email')}</Button>
        </div>
      </div>
      {edit && <MeetingEditor initial={meeting} onClose={() => setEdit(false)} onSaved={() => toast.show(t('savedToast'))} onDeleted={onBack} />}
      {toast.node}
    </>
  )
}

function MeetingEditor({ initial, onClose, onSaved, onDeleted }) {
  const { t, lang } = useT()
  const meetings = useCollection('meetings')
  const departments = useCollection('departments')
  const [f, setF] = useState({ title: '', date: todayISO(), attendees: '', notes: '', departmentId: '', context: 'team', actions: [], ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.title.trim()) { setErr(t('required')); return }
    const rec = { ...f, title: f.title.trim() }
    initial.id ? meetings.save({ ...rec, id: initial.id }) : meetings.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editMeeting') : t('addMeeting')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { meetings.remove(initial.id); onClose(); onDeleted && onDeleted() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('meetingTitle')} required error={err}><Input value={f.title} onChange={set('title')} placeholder={t('meetingPlaceholder')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label={t('context')}>
          <Select value={f.context} onChange={set('context')} options={[
            { value: 'team', label: t('team') }, { value: 'boss', label: t('myManager') }, { value: 'external', label: t('external') },
          ]} />
        </Field>
      </div>
      <Field label={t('attendees')} hint={t('optional')}><Input value={f.attendees} onChange={set('attendees')} placeholder={t('attendeesPlaceholder')} /></Field>
      {departments.items.length > 0 && (
        <Field label={t('department')} hint={t('optional')}>
          <Select value={f.departmentId} onChange={set('departmentId')}>
            <option value="">{t('none')}</option>
            {departments.items.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t('notesField')}><TextArea value={f.notes} onChange={set('notes')} placeholder={t('meetingNotesPlaceholder')} rows={5} /></Field>
    </Sheet>
  )
}
