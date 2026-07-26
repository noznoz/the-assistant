import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Section, Button, Empty, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { RELATIONSHIPS, findPriority, label } from '../../lib/domain.js'
import { relativeDay, fmtTime } from '../../lib/format.js'
import { whatsappToPerson, formatAssignment, personDigits } from '../../lib/share.js'
import { completeTask } from '../../lib/recurrence.js'
import PersonEditor from './PersonEditor.jsx'
import TaskEditor from '../tasks/TaskEditor.jsx'

export default function PersonProfile({ person, onBack, onDeleted }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const [editor, setEditor] = useState(false)      // edit person
  const [assigning, setAssigning] = useState(false) // task editor
  const toast = useToast()

  const mine = tasks.items.filter(x =>
    (x.assigneeId && x.assigneeId === person.id) ||
    (!x.assigneeId && x.assignedTo && x.assignedTo === person.name))
  const open = mine.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
  const done = mine.filter(x => x.status === 'completed')

  const rel = RELATIONSHIPS.find(r => r.id === person.relationship)
  const initials = (person.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const digits = personDigits(person)

  const sendTask = (task) => whatsappToPerson(person, formatAssignment(task, person, lang, settings))

  return (
    <>
      <DetailHeader title={person.name} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEditor(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        {/* Header card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 0 6px' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-tint)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 750, border: '1px solid var(--line)' }}>
            {person.photo ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <h1 style={{ fontSize: 22 }}>{person.name}</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {[rel ? label(rel, lang) : '', person.jobTitle, person.company].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Quick contact actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '10px 0 6px' }}>
          {digits && <ContactBtn icon="whatsapp" label={t('message')} tint="var(--ok)"
            onClick={() => whatsappToPerson(person, lang === 'ar' ? `مرحباً ${person.name}` : `Hi ${person.name}`)} />}
          {person.mobile && <ContactBtn icon="phone" label={t('call')} onClick={() => window.open(`tel:${person.mobile}`)} />}
          {person.email && <ContactBtn icon="mail" label={t('email')} onClick={() => window.open(`mailto:${person.email}`)} />}
        </div>

        <Button block variant="primary" icon="plus" style={{ marginTop: 12 }} onClick={() => setAssigning(true)}>
          {t('assignTask')}
        </Button>

        {/* Their open tasks */}
        <Section title={t('theirTasks')} count={open.length} />
        {open.length === 0 ? (
          <Empty icon="check" title={t('noTasksAssigned')}
            action={<Button variant="primary" icon="plus" onClick={() => setAssigning(true)}>{t('assignTask')}</Button>} />
        ) : open.map(task => {
          const pr = findPriority(task.priority)
          return (
            <div className="li" key={task.id}>
              <button className="check" onClick={() => { completeTask(task, tasks); toast.show('✓') }} aria-label={t('markComplete')} />
              <div className="body">
                <div className="title">{task.title}</div>
                <div className="meta">
                  {pr && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: pr.color }} />{t(pr.key)}</span>}
                  {task.dueDate && <span>· {relativeDay(task.dueDate, lang)}{task.dueTime ? ` ${fmtTime(task.dueTime, lang)}` : ''}</span>}
                </div>
              </div>
              <button className="iconbtn" style={{ color: 'var(--ok)' }} aria-label={t('sendOnWhatsApp')} onClick={() => sendTask(task)}><Icon name="whatsapp" size={18} /></button>
            </div>
          )
        })}

        {done.length > 0 && (
          <>
            <Section title={t('completed')} count={done.length} />
            {done.slice(0, 5).map(task => (
              <div className="li done" key={task.id}>
                <div className="check on"><Icon name="check" size={16} stroke={3} /></div>
                <div className="body"><div className="title">{task.title}</div></div>
              </div>
            ))}
          </>
        )}

        {open.length > 0 && (
          <p className="center muted" style={{ fontSize: 12, marginTop: 16 }}>
            <Icon name="whatsapp" size={12} /> {t('sendTaskHint')}
          </p>
        )}
      </div>

      {editor && <PersonEditor initial={person} onClose={() => setEditor(false)}
        onSaved={(p) => { if (!p) onDeleted && onDeleted(); toast.show(t('savedToast')) }} />}
      {assigning && <TaskEditor
        initial={{ assigneeId: person.id, assignedTo: person.name, type: 'request', status: 'waiting_someone', classification: 'personal' }}
        onClose={() => setAssigning(false)}
        onSaved={() => toast.show(t('assignedToast'))} />}
      {toast.node}
    </>
  )
}

function ContactBtn({ icon, label, onClick, tint }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 0, color: 'var(--ink-2)', fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: tint || 'var(--ink)' }}>
        <Icon name={icon} size={20} />
      </span>
      {label}
    </button>
  )
}
