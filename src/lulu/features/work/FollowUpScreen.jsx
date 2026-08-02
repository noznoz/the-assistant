import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Empty, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { isOverdue, daysUntil, relativeDay, fmtDate } from '../../lib/format.js'
import { taskMemberIds } from '../../lib/org.js'
import { findPriority } from '../../lib/domain.js'
import { whatsappToPerson, personDigits, formatTaskDetail, share, emailShare } from '../../lib/share.js'

// Delegation follow-up radar: everything you've handed out and everything on
// your plate from the boss, plus a shareable weekly digest.
export default function FollowUpScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const members = useCollection('members')
  const departments = useCollection('departments')

  const open = tasks.items.filter(x => x.classification === 'work' && x.status !== 'completed' && x.status !== 'cancelled')
  const byUrgency = (a, b) => (isOverdue(b.dueDate) - isOverdue(a.dueDate)) || ((a.dueDate || '9999').localeCompare(b.dueDate || '9999'))

  const waitingOnOthers = open.filter(x => !x.boss && taskMemberIds(x).length).sort(byUrgency)
  const fromBoss = open.filter(x => x.boss === 'down').sort(byUrgency)
  const toDiscuss = open.filter(x => x.boss === 'up').sort(byUrgency)
  const waitingOnMe = open.filter(x => x.status === 'waiting_me' && !x.boss).sort(byUrgency)

  const firstAssignee = (x) => members.items.find(m => m.id === (taskMemberIds(x)[0]))
  const overdueCount = waitingOnOthers.filter(x => isOverdue(x.dueDate)).length

  const digest = useMemo(() => buildDigest({ open, departments: departments.items, members: members.items, fromBoss, toDiscuss, lang, settings, t }),
    [tasks.items, departments.items, members.items, lang])

  const Row = ({ x, nudge }) => {
    const pr = findPriority(x.priority)
    const overdue = isOverdue(x.dueDate)
    const asg = firstAssignee(x)
    return (
      <div className="li">
        <div className="body" onClick={() => x.departmentId ? go(`work/${x.departmentId}`) : go('work')}>
          <div className="title">{x.title}</div>
          <div className="meta">
            {x.assignedTo && <span>{x.assignedTo}</span>}
            {pr && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>· <span style={{ width: 7, height: 7, borderRadius: 4, background: pr.color }} />{t(pr.key)}</span>}
            {x.dueDate && <span className={overdue ? 't-danger' : ''}>· {relativeDay(x.dueDate, lang)}</span>}
          </div>
        </div>
        {nudge && asg && personDigits(asg) && (
          <button className="iconbtn" style={{ color: 'var(--ok)' }} aria-label={t('nudge')}
            onClick={() => whatsappToPerson(asg, formatTaskDetail(x, lang, settings, { department: '' }))}>
            <Icon name="whatsapp" size={18} />
          </button>
        )}
      </div>
    )
  }

  const empty = !waitingOnOthers.length && !fromBoss.length && !toDiscuss.length && !waitingOnMe.length

  return (
    <>
      <DetailHeader title={t('followUps')} onBack={() => go('work')} right={
        <button className="iconbtn" onClick={() => share(digest)} aria-label={t('shareDigest')}><Icon name="whatsapp" size={18} /></button>
      } />
      <div className="screen">
        {empty ? (
          <Empty icon="bell" title={t('allClear')} text={t('followUpsHint')} />
        ) : (
          <>
            <Card style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="lead t-warn" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="bell" size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{waitingOnOthers.length} {t('awaitingOthers')}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{overdueCount > 0 ? `${overdueCount} ${t('overdue')}` : t('onTrack')}</div>
              </div>
            </Card>

            {waitingOnOthers.length > 0 && (
              <>
                <Section title={t('waitingOnOthers')} count={waitingOnOthers.length} />
                <Card tight>{waitingOnOthers.map(x => <Row key={x.id} x={x} nudge />)}</Card>
              </>
            )}
            {fromBoss.length > 0 && (
              <>
                <Section title={t('assignedByBoss')} count={fromBoss.length} />
                <Card tight>{fromBoss.map(x => <Row key={x.id} x={x} />)}</Card>
              </>
            )}
            {toDiscuss.length > 0 && (
              <>
                <Section title={t('toDiscussWithBoss')} count={toDiscuss.length} />
                <Card tight>{toDiscuss.map(x => <Row key={x.id} x={x} />)}</Card>
              </>
            )}
            {waitingOnMe.length > 0 && (
              <>
                <Section title={t('st_waiting_me')} count={waitingOnMe.length} />
                <Card tight>{waitingOnMe.map(x => <Row key={x.id} x={x} />)}</Card>
              </>
            )}

            <div className="row2" style={{ marginTop: 16 }}>
              <Button icon="whatsapp" onClick={() => share(digest)}>{t('shareWhatsApp')}</Button>
              <Button icon="mail" onClick={() => emailShare(t('weeklyDigest'), digest)}>{t('email')}</Button>
            </div>
            <p className="hint center" style={{ marginTop: 10 }}>{t('digestHint')}</p>
          </>
        )}
      </div>
    </>
  )
}

// Plain-text weekly digest grouped by department, with boss items appended.
function buildDigest({ open, departments, members, fromBoss, toDiscuss, lang, settings, t }) {
  const thisWeek = open.filter(x => !x.boss && (isOverdue(x.dueDate) || (() => { const d = daysUntil(x.dueDate); return d != null && d >= 0 && d <= 7 })()))
  const lines = [`📋 ${t('weeklyDigest')} — ${fmtDate(new Date().toISOString().slice(0, 10), lang, settings.dateFormat)}`, '']
  const shown = new Set()
  for (const dep of departments) {
    const items = thisWeek.filter(x => x.departmentId === dep.id && !shown.has(x.id)).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    if (!items.length) continue
    lines.push(`— ${dep.name} —`)
    items.forEach(x => {
      shown.add(x.id)
      const who = x.assignedTo ? ` · ${x.assignedTo}` : ''
      const when = x.dueDate ? ` (${relativeDay(x.dueDate, lang)})` : ''
      const flag = isOverdue(x.dueDate) ? ' ⚠️' : ''
      lines.push(`• ${x.title}${who}${when}${flag}`)
    })
    lines.push('')
  }
  const leftovers = thisWeek.filter(x => !shown.has(x.id))
  if (leftovers.length) {
    lines.push(`— ${t('other')} —`)
    leftovers.forEach(x => lines.push(`• ${x.title}${x.assignedTo ? ` · ${x.assignedTo}` : ''}${x.dueDate ? ` (${relativeDay(x.dueDate, lang)})` : ''}`))
    lines.push('')
  }
  if (fromBoss.length || toDiscuss.length) {
    lines.push(`— ${t('withBoss')} —`)
    fromBoss.forEach(x => lines.push(`• ${t('fromBoss')}: ${x.title}${x.dueDate ? ` (${relativeDay(x.dueDate, lang)})` : ''}`))
    toDiscuss.forEach(x => lines.push(`• ${t('toDiscuss')}: ${x.title}`))
  }
  if (lines.length <= 2) lines.push(t('allClear'))
  return lines.join('\n').trim()
}
