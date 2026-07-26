import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Chip, Fab, Sheet, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { findPriority, findStatus, findType } from '../../lib/domain.js'
import { isToday, isOverdue, relativeDay, fmtTime } from '../../lib/format.js'
import { share, formatTask, formatFollowUp, copyText, whatsappToPerson, formatAssignment, personDigits } from '../../lib/share.js'
import TaskEditor from './TaskEditor.jsx'

const VIEWS = [
  { id: 'all', key: 'allTasks' },
  { id: 'today', key: 'today' },
  { id: 'upcoming', key: 'upcoming' },
  { id: 'overdue', key: 'overdue' },
  { id: 'waiting_me', key: 'waitingForMe' },
  { id: 'delegated', key: 'delegatedTasks' },
  { id: 'completed', key: 'completed' },
]

export default function TasksScreen({ param, go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const people = useCollection('people')
  const [view, setView] = useState(VIEWS.some(v => v.id === param) ? param : 'all')
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState(null)   // {} for new, task for edit
  const [sheet, setSheet] = useState(null)      // task action sheet
  const toast = useToast()

  const filtered = useMemo(() => {
    let list = tasks.items
    if (q.trim()) {
      const s = q.toLowerCase()
      list = list.filter(x => (x.title + ' ' + (x.description || '') + ' ' + (x.assignedTo || '') + ' ' + (x.project || '')).toLowerCase().includes(s))
    }
    const openOnly = list.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
    switch (view) {
      case 'today': return openOnly.filter(x => isToday(x.dueDate))
      case 'upcoming': return openOnly.filter(x => x.dueDate && !isOverdue(x.dueDate)).sort(byDue)
      case 'overdue': return openOnly.filter(x => isOverdue(x.dueDate))
      case 'waiting_me': return openOnly.filter(x => x.status === 'waiting_me')
      case 'delegated': return openOnly.filter(x => x.status === 'waiting_someone')
      case 'completed': return list.filter(x => x.status === 'completed')
      default: return list.filter(x => x.status !== 'cancelled').sort(byRank)
    }
  }, [tasks.items, view, q])

  const toggleComplete = (task) => {
    const done = task.status === 'completed'
    tasks.patch(task.id, { status: done ? 'new' : 'completed', completedAt: done ? null : new Date().toISOString() })
    if (!done) toast.show('✓ ' + t('completed'))
  }

  return (
    <>
      <TopBar title={t('tasks')} right={
        <button className="iconbtn" onClick={() => setSheet({ search: true })} aria-label={t('search')}><Icon name="search" size={18} /></button>
      } />
      <div className="screen">
        {sheet?.search != null && (
          <div className="field" style={{ marginTop: 12 }}>
            <input className="input" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} autoFocus />
          </div>
        )}
        <div className="chip-row" style={{ marginTop: 12, marginBottom: 6 }}>
          {VIEWS.map(v => (
            <Chip key={v.id} selectable on={view === v.id} onClick={() => setView(v.id)}>{t(v.key)}</Chip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty icon="check" title={t('nothingHere')} text={t('inboxSubtitle')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newTask')}</Button>} />
        ) : (
          <div style={{ marginTop: 10 }}>
            {filtered.map(task => (
              <TaskRow key={task.id} task={task} lang={lang} dateFormat={settings.dateFormat}
                onToggle={() => toggleComplete(task)} onOpen={() => setSheet({ task })} />
            ))}
          </div>
        )}
      </div>

      <Fab onClick={() => setEditor({})} />

      {editor && <TaskEditor initial={editor.id ? editor : (editor.title !== undefined ? editor : {})} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}

      {sheet?.task && (
        <TaskActionSheet task={sheet.task} lang={lang} settings={settings} people={people.items}
          onClose={() => setSheet(null)}
          onEdit={() => { setEditor(sheet.task); setSheet(null) }}
          onComplete={() => { toggleComplete(sheet.task); setSheet(null) }}
          onDuplicate={() => { const { id, createdAt, updatedAt, ...rest } = sheet.task; tasks.add({ ...rest, title: rest.title + ' (copy)' }); setSheet(null); toast.show(t('savedToast')) }}
          onDelete={() => { tasks.remove(sheet.task.id); setSheet(null); toast.show(t('deletedToast')) }}
          onCopyFollowUp={async () => { const ok = await copyText(formatFollowUp(sheet.task, lang, settings)); toast.show(ok ? t('copiedToast') : '...'); }}
        />
      )}
      {toast.node}
    </>
  )
}

const rank = { critical: 0, high: 1, medium: 2, low: 3 }
function byRank(a, b) { return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) }
function byDue(a, b) { return (a.dueDate || '9999').localeCompare(b.dueDate || '9999') }

function TaskRow({ task, lang, dateFormat, onToggle, onOpen }) {
  const { t } = useT()
  const pr = findPriority(task.priority)
  const st = findStatus(task.status)
  const done = task.status === 'completed'
  const overdue = !done && isOverdue(task.dueDate)
  return (
    <div className={`li ${done ? 'done' : ''}`}>
      <button className={`check ${done ? 'on' : ''}`} onClick={onToggle} aria-label={t('markComplete')}>
        {done && <Icon name="check" size={16} stroke={3} />}
      </button>
      <div className="body" onClick={onOpen}>
        <div className="title">{task.title}</div>
        <div className="meta">
          {pr && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: pr.color, display: 'inline-block' }} />{t(pr.key)}
          </span>}
          {task.dueDate && <span className={overdue ? 't-danger' : ''} style={overdue ? { padding: '1px 6px', borderRadius: 6 } : undefined}>
            {relativeDay(task.dueDate, lang)}{task.dueTime ? ` · ${fmtTime(task.dueTime, lang)}` : ''}
          </span>}
          {task.assignedTo && <span>· {task.assignedTo}</span>}
          {!done && st && task.status !== 'new' && <span>· {t(st.key)}</span>}
        </div>
      </div>
    </div>
  )
}

function TaskActionSheet({ task, lang, settings, people = [], onClose, onEdit, onComplete, onDuplicate, onDelete, onCopyFollowUp }) {
  const { t } = useT()
  const type = findType(task.type)
  const assignee = people.find(p => p.id === task.assigneeId) || people.find(p => p.name === task.assignedTo)
  const canSend = assignee && personDigits(assignee)
  return (
    <Sheet title={task.title} onClose={onClose}>
      <div className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        {type ? t(type.key) : ''}{task.assignedTo ? ` · ${task.assignedTo}` : ''}{task.project ? ` · ${task.project}` : ''}
      </div>
      {task.description && <p style={{ marginBottom: 16 }}>{task.description}</p>}
      <div className="stack">
        <Button block icon="check" onClick={onComplete}>{task.status === 'completed' ? t('st_new') : t('markComplete')}</Button>
        {canSend && (
          <Button block icon="whatsapp" variant="brand"
            onClick={() => whatsappToPerson(assignee, formatAssignment(task, assignee, lang, settings))}>
            {t('sendOnWhatsApp')} · {assignee.name}
          </Button>
        )}
        <Button block icon="whatsapp" variant={canSend ? '' : 'brand'} onClick={() => share(formatTask(task, lang, settings))}>{t('shareWhatsApp')}</Button>
        {(task.type === 'follow_up' || task.type === 'request' || task.status === 'waiting_someone') &&
          <Button block icon="sparkle" onClick={onCopyFollowUp}>Draft follow-up message</Button>}
        <div className="row2">
          <Button icon="edit" onClick={onEdit}>{t('edit')}</Button>
          <Button icon="duplicate" onClick={onDuplicate}>{t('add')}</Button>
        </div>
        <Button block variant="danger" icon="trash" onClick={onDelete}>{t('delete')}</Button>
      </div>
    </Sheet>
  )
}
