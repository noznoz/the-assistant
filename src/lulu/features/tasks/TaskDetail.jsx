import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { findPriority, findStatus, findType } from '../../lib/domain.js'
import { relativeDay, fmtTime } from '../../lib/format.js'
import { shareAttachments } from '../../lib/files.js'

const REMIND_KEY = { morning: 'remindMorning', dayBefore: 'remindDayBefore', hourBefore: 'remindHourBefore' }

// Read-only view of everything on a task: status, priority, due, reminder,
// people, description, checklist, attachments and tags. Opened from the task
// action sheet via "View details"; an Edit button jumps into editing.
export default function TaskDetail({ task, people = [], lang, onClose, onEdit }) {
  const { t } = useT()
  const pr = findPriority(task.priority)
  const st = findStatus(task.status)
  const type = findType(task.type)
  const assignee = people.find(p => p.id === task.assigneeId) || people.find(p => p.name === task.assignedTo)
  const subs = task.subtasks || []
  const atts = task.attachments || []
  const tags = (task.tags || '').split(',').map(s => s.trim()).filter(Boolean)
  const remind = task.remind && task.remind !== 'none' ? t(REMIND_KEY[task.remind] || 'remindMe') : ''

  const Row = ({ label, children }) => (children || children === 0) ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <span className="muted" style={{ fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'end', minWidth: 0 }}>{children}</span>
    </div>
  ) : null

  return (
    <Sheet title={task.title} onClose={onClose}>
      <div className="chip-row" style={{ margin: '-2px 0 10px' }}>
        {st && <span className="chip"><span className="dot" style={{ background: 'var(--ink-3)' }} /> {t(st.key)}</span>}
        {pr && <span className="chip"><span className="dot" style={{ background: pr.color }} /> {t(pr.key)}</span>}
        {type && <span className="chip">{t(type.key)}</span>}
      </div>

      {task.description && <p style={{ margin: '0 0 12px', color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{task.description}</p>}

      <div style={{ marginBottom: 6 }}>
        <Row label={t('dueDate')}>{task.dueDate ? `${relativeDay(task.dueDate, lang)}${task.dueTime ? ` · ${fmtTime(task.dueTime, lang)}` : ''}` : null}</Row>
        <Row label={t('remindMe')}>{remind || null}</Row>
        <Row label={t('assignedTo')}>{assignee ? assignee.name : (task.assignedTo || null)}</Row>
        <Row label={t('requestedBy')}>{task.requestedBy || null}</Row>
        <Row label={t('project')}>{task.project || null}</Row>
      </div>

      {subs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="section-h" style={{ margin: '4px 2px 8px' }}>
            <h2>{t('checklist')}</h2><span className="count">{subs.filter(s => s.done).length}/{subs.length}</span>
          </div>
          {subs.map(s => (
            <div key={s.id} className="li" style={{ margin: '0 0 8px', padding: '10px 12px' }}>
              <span className={`check ${s.done ? 'on' : ''}`} style={{ width: 22, height: 22, pointerEvents: 'none' }}>
                {s.done ? <Icon name="check" size={13} stroke={3} /> : null}
              </span>
              <div className="body"><div className="title" style={{ fontSize: 14, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>{s.text}</div></div>
            </div>
          ))}
        </div>
      )}

      {atts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="section-h" style={{ margin: '4px 2px 8px' }}><h2>{t('attachments')}</h2><span className="count">{atts.length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {atts.map(a => (
              <button key={a.id} onClick={() => shareAttachments([a])} aria-label={a.name || t('attachments')}
                style={{ all: 'unset', cursor: 'pointer', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)', display: 'block' }}>
                {a.thumb ? <img src={a.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)' }}><Icon name="doc" size={20} /></div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="chip-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {tags.map((tg, i) => <span key={i} className="chip">#{tg}</span>)}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <Button block variant="primary" icon="edit" onClick={onEdit}>{t('edit')}</Button>
      </div>
    </Sheet>
  )
}
