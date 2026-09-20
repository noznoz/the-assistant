import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Field, Input, TextArea, Select, Button, Chip } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { uid } from '../../store/db.js'
import { TASK_TYPES, STATUSES, PRIORITIES } from '../../lib/domain.js'
import { RECURRENCE } from '../../lib/recurrence.js'
import { todayISO } from '../../lib/format.js'
import PersonEditor from '../people/PersonEditor.jsx'

const empty = {
  title: '', description: '', type: 'task', classification: 'work',
  priority: 'medium', status: 'new', dueDate: '', dueTime: '',
  project: '', requestedBy: '', assignedTo: '', assigneeId: '', tags: '',
  followUp: '', recurrence: 'none', relatedVehicle: '',
}

export default function TaskEditor({ initial, onClose, onSaved }) {
  const { t } = useT()
  const tasks = useCollection('tasks')
  const vehicles = useCollection('vehicles')
  const people = useCollection('people')
  const [f, setF] = useState({ ...empty, ...initial })
  const [err, setErr] = useState('')
  const [addingPerson, setAddingPerson] = useState(false)
  const [subText, setSubText] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // Checklist / sub-tasks — same { id, text, done } model as Work tasks, so a
  // task's sub-tasks show and stay editable wherever it's opened.
  const subs = f.subtasks || []
  const addSub = () => { const v = subText.trim(); if (!v) return; setF({ ...f, subtasks: [...subs, { id: uid(), text: v, done: false }] }); setSubText('') }
  const toggleSub = (id) => setF({ ...f, subtasks: subs.map(s => s.id === id ? { ...s, done: !s.done } : s) })
  const editSub = (id, text) => setF({ ...f, subtasks: subs.map(s => s.id === id ? { ...s, text } : s) })
  const removeSub = (id) => setF({ ...f, subtasks: subs.filter(s => s.id !== id) })

  const onAssignee = (e) => {
    const v = e.target.value
    if (v === '__add') { setAddingPerson(true); return }
    const p = people.items.find(x => x.id === v)
    setF(prev => ({ ...prev, assigneeId: v, assignedTo: p ? p.name : '' }))
  }

  // A legacy task may carry an assignedTo name without a linked person id.
  const legacyName = !f.assigneeId && f.assignedTo ? f.assignedTo : ''
  const assigneeValue = f.assigneeId || (legacyName ? '__legacy' : '')

  const submit = () => {
    if (!f.title.trim()) { setErr(t('required')); return }
    const rec = { ...f, title: f.title.trim() }
    if (initial?.id) tasks.save({ ...rec, id: initial.id })
    else tasks.add(rec)
    onSaved && onSaved()
    onClose()
  }

  const doDelete = () => {
    if (!window.confirm(t('deleteTaskQ'))) return
    tasks.remove(initial.id)
    onClose()
  }

  return (
    <>
      <Sheet title={initial?.id ? t('editTask') : t('newTask')} onClose={onClose}
        footer={<div className="stack">
          <Button variant="primary" block onClick={submit}>{t('save')}</Button>
          {initial?.id && <Button block variant="danger" icon="trash" onClick={doDelete}>{t('delete')}</Button>}
        </div>}>
        <Field label={t('title')} required error={err}>
          <Input value={f.title} onChange={set('title')} placeholder={t('title')} autoFocus />
        </Field>
        <Field label={t('description')}>
          <TextArea value={f.description} onChange={set('description')} />
        </Field>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '0 2px 7px' }}>{t('priority')}</label>
          <div className="chip-row">
            {PRIORITIES.map(p => (
              <Chip key={p.id} selectable on={f.priority === p.id} tint={f.priority === p.id ? '' : p.tint}
                onClick={() => setF({ ...f, priority: p.id })}>{t(p.key)}</Chip>
            ))}
          </div>
        </div>

        {/* Assign to a person / family member */}
        <Field label={t('assignedTo')}>
          <Select value={assigneeValue} onChange={onAssignee}>
            <option value="">{t('unassigned')}</option>
            {legacyName && <option value="__legacy">{legacyName}</option>}
            {people.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__add">{t('addNewPerson')}</option>
          </Select>
        </Field>

        <div className="row2">
          <Field label={t('type')}>
            <Select value={f.type} onChange={set('type')} options={TASK_TYPES.map(x => ({ value: x.id, label: t(x.key) }))} />
          </Field>
          <Field label={t('status')}>
            <Select value={f.status} onChange={set('status')} options={STATUSES.map(x => ({ value: x.id, label: t(x.key) }))} />
          </Field>
        </div>

        <div className="row2">
          <Field label={t('dueDate')}>
            <Input type="date" value={f.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label={t('dueTime')}>
            <Input type="time" value={f.dueTime} onChange={set('dueTime')} />
          </Field>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '0 2px 7px' }}>{t('workOrPersonal')}</label>
          <div className="chip-row">
            <Chip selectable on={f.classification === 'work'} onClick={() => setF({ ...f, classification: 'work' })}>{t('work')}</Chip>
            <Chip selectable on={f.classification === 'personal'} onClick={() => setF({ ...f, classification: 'personal' })}>{t('personal')}</Chip>
          </div>
        </div>

        <div className="row2">
          <Field label={t('requestedBy')}><Input value={f.requestedBy} onChange={set('requestedBy')} /></Field>
          <Field label={t('project')}><Input value={f.project} onChange={set('project')} /></Field>
        </div>

        <div className="row2">
          <Field label={t('followUp')}><Input type="date" value={f.followUp} onChange={set('followUp')} /></Field>
          <Field label={t('rec')}>
            <Select value={f.recurrence} onChange={set('recurrence')} options={RECURRENCE.map(r => ({ value: r.id, label: t(r.key) }))} />
          </Field>
        </div>

        {vehicles.items.length > 0 && (
          <Field label={t('relatedVehicle')}>
            <Select value={f.relatedVehicle} onChange={set('relatedVehicle')}>
              <option value="">{t('none')}</option>
              {vehicles.items.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
        )}

        <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '8px 2px 7px' }}>
          {t('checklist')}{subs.length ? ` · ${subs.filter(s => s.done).length}/${subs.length}` : ''}
        </label>
        {subs.map(s => (
          <div key={s.id} className="li" style={{ margin: '0 0 8px' }}>
            <button className={`check ${s.done ? 'on' : ''}`} onClick={() => toggleSub(s.id)} aria-label={t('markComplete')}>
              {s.done && <Icon name="check" size={14} stroke={3} />}
            </button>
            <div className="body">
              <input value={s.text} onChange={e => editSub(s.id, e.target.value)} aria-label={t('editSubtask')}
                style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--ink)', fontSize: 14, padding: '2px 0', outline: 'none', textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }} />
            </div>
            <button className="iconbtn" aria-label={t('delete')} onClick={() => removeSub(s.id)}><Icon name="x" size={15} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, margin: '6px 0 16px' }}>
          <Input value={subText} onChange={e => setSubText(e.target.value)} placeholder={t('addSubtask')} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }} style={{ flex: 1 }} />
          <Button icon="plus" onClick={addSub}>{t('add')}</Button>
        </div>

        <Field label={t('tags')} hint="comma,separated">
          <Input value={f.tags} onChange={set('tags')} />
        </Field>
      </Sheet>

      {addingPerson && (
        <PersonEditor
          onClose={() => setAddingPerson(false)}
          onSaved={(p) => { if (p) setF(prev => ({ ...prev, assigneeId: p.id, assignedTo: p.name })) }}
        />
      )}
    </>
  )
}

export { empty as emptyTask, todayISO }
