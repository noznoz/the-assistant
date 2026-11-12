import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { findPriority, findStatus, findType } from '../../lib/domain.js'
import { relativeDay, fmtTime } from '../../lib/format.js'
import { shareAttachments } from '../../lib/files.js'
import { laterTodayTime } from './useTaskActions.js'

const REMIND_KEY = { morning: 'remindMorning', dayBefore: 'remindDayBefore', hourBefore: 'remindHourBefore' }

// Everything on a task in one panel: status, priority, due, reminder, people,
// description, checklist, attachments and tags — with the actions you need
// most as large buttons (Mark as done, Snooze, Follow up, Edit). The action
// props are optional; without them it is a read-only view with Edit.
export default function TaskDetail({ task, people = [], lang, onClose, onEdit, onComplete, onSnooze, onFollowUp, onToggleSub }) {
  const { t } = useT()
  const [snoozing, setSnoozing] = useState(false)
  const done = task.status === 'completed'
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
      <span className="muted" style={{ fontSize: 15, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 600, textAlign: 'end', minWidth: 0 }}>{children}</span>
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
              {onToggleSub ? (
                <button className={`check ${s.done ? 'on' : ''}`} onClick={() => onToggleSub(s.id)} aria-pressed={!!s.done} aria-label={s.text}>
                  {s.done ? <Icon name="check" size={15} stroke={3} /> : null}
                </button>
              ) : (
                <span className={`check ${s.done ? 'on' : ''}`} style={{ width: 22, height: 22, pointerEvents: 'none' }}>
                  {s.done ? <Icon name="check" size={13} stroke={3} /> : null}
                </span>
              )}
              <div className="body"><div className="title" style={{ fontSize: 16, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>{s.text}</div></div>
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

      {onComplete ? (
        <div style={{ marginTop: 20 }}>
          <Button block variant={done ? '' : 'brand'} icon="check" onClick={onComplete}>{done ? t('markNotDone') : t('markDone')}</Button>
          <div className="act-row">
            {!done && onSnooze && (
              <button className="act" onClick={() => setSnoozing(v => !v)} aria-expanded={snoozing}><Icon name="clock" size={22} />{t('snooze')}</button>
            )}
            {onFollowUp && <button className="act" onClick={onFollowUp}><Icon name="whatsapp" size={22} />{t('followUpAct')}</button>}
            <button className="act" onClick={onEdit}><Icon name="edit" size={22} />{t('edit')}</button>
          </div>
          {snoozing && !done && onSnooze && (
            <div className="chip-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {laterTodayTime() && <button className="chip selectable big" onClick={() => onSnooze('later')}>{t('laterToday')}</button>}
              <button className="chip selectable big" onClick={() => onSnooze('tomorrow')}>{t('tomorrow')}</button>
              <button className="chip selectable big" onClick={() => onSnooze('week')}>{t('nextWeek')}</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          <Button block variant="primary" icon="edit" onClick={onEdit}>{t('edit')}</Button>
        </div>
      )}
    </Sheet>
  )
}
