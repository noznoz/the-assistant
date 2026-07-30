import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Section, Card, Button, Empty, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { RELATIONSHIPS, findPriority, label } from '../../lib/domain.js'
import { relativeDay, fmtTime } from '../../lib/format.js'
import { whatsappToPerson, formatAssignment, formatNudge, formatNudgeList, personDigits, share } from '../../lib/share.js'
import EntityDocuments from '../shared/EntityDocuments.jsx'
import { completeTask } from '../../lib/recurrence.js'
import { pointsFor, awardPoints } from '../../lib/points.js'
import PersonEditor from './PersonEditor.jsx'
import TaskEditor from '../tasks/TaskEditor.jsx'
import { RedeemSheet } from './RewardsScreen.jsx'

export default function PersonProfile({ person, onBack, onDeleted }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const people = useCollection('people')
  const [editor, setEditor] = useState(false)      // edit person
  const [assigning, setAssigning] = useState(false) // task editor
  const [redeem, setRedeem] = useState(false)
  const toast = useToast()

  const mine = tasks.items.filter(x =>
    (x.assigneeId && x.assigneeId === person.id) ||
    (!x.assigneeId && x.assignedTo && x.assignedTo === person.name))
  const open = mine.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
  const done = mine.filter(x => x.status === 'completed')

  const rel = RELATIONSHIPS.find(r => r.id === person.relationship)
  const initials = (person.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const digits = personDigits(person)

  const healthRows = [
    [t('bloodType'), person.bloodType],
    [t('allergies'), person.allergies],
    [t('conditions'), person.conditions],
    [t('medications'), person.medications],
    [t('doctor'), person.doctor],
    [t('healthInsurer'), [person.healthInsurer, person.healthPolicy].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v)
  const shareMedicalCard = () => {
    const L = lang === 'ar'
    share([
      `🚑 ${L ? 'بطاقة طبية' : 'Medical card'} — ${person.name}`,
      person.bloodType && `${L ? 'فصيلة الدم' : 'Blood type'}: ${person.bloodType}`,
      person.allergies && `${L ? 'حساسية' : 'Allergies'}: ${person.allergies}`,
      person.conditions && `${L ? 'حالات' : 'Conditions'}: ${person.conditions}`,
      person.medications && `${L ? 'أدوية' : 'Medications'}: ${person.medications}`,
      person.doctor && `${L ? 'الطبيب' : 'Doctor'}: ${person.doctor}`,
      person.mobile && `${L ? 'هاتف' : 'Phone'}: ${person.mobile}`,
    ].filter(Boolean).join('\n'))
  }

  const sendTask = (task) => whatsappToPerson(person, formatAssignment(task, person, lang, settings))
  const nudge = (task) => { whatsappToPerson(person, formatNudge(task, person, lang, settings)); toast.show(t('nudgedToast')) }
  const nudgeAll = () => { whatsappToPerson(person, formatNudgeList(open, person, lang, settings)); toast.show(t('nudgedToast')) }
  const points = Number(person.points) || 0
  const toggle = (task) => {
    const wasDone = task.status === 'completed'
    completeTask(task, tasks)
    awardPoints(person, wasDone ? -pointsFor(task) : pointsFor(task), people)
    toast.show(wasDone ? '↩︎' : `✓ +${pointsFor(task)} ${t('pts')}`)
  }

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
          {points > 0 && <Chip tint="t-brand" style={{ marginTop: 6 }}><Icon name="sparkle" size={12} /> {points} {t('pts')}</Chip>}
        </div>

        {/* Quick contact actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '10px 0 6px' }}>
          {digits && <ContactBtn icon="whatsapp" label={t('message')} tint="var(--ok)"
            onClick={() => whatsappToPerson(person, lang === 'ar' ? `مرحباً ${person.name}` : `Hi ${person.name}`)} />}
          {person.mobile && <ContactBtn icon="phone" label={t('call')} onClick={() => window.open(`tel:${person.mobile}`)} />}
          {person.email && <ContactBtn icon="mail" label={t('email')} onClick={() => window.open(`mailto:${person.email}`)} />}
        </div>

        <div className="row2" style={{ marginTop: 12 }}>
          <Button variant="primary" icon="plus" onClick={() => setAssigning(true)}>{t('assignTask')}</Button>
          <Button icon="whatsapp" disabled={open.length === 0} onClick={nudgeAll}>{t('nudgeAll')}</Button>
        </div>
        {points > 0 && <Button block icon="gift" style={{ marginTop: 10 }} onClick={() => setRedeem(true)}>{t('redeemReward')}</Button>}

        {/* Health & medical */}
        {healthRows.length > 0 && (
          <>
            <Section title={t('healthMedical')} />
            <Card className="stack">
              {healthRows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                  <span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'end' }}>{v}</span>
                </div>
              ))}
              <Button block icon="share" onClick={shareMedicalCard}>{t('shareMedicalCard')}</Button>
            </Card>
          </>
        )}

        {/* Medical documents */}
        <Section title={t('medicalDocuments')} />
        <EntityDocuments filterKey="personId" id={person.id} hint={t('medicalDocsHint')} />

        {/* Their open tasks */}
        <Section title={t('theirTasks')} count={open.length} />
        {open.length === 0 ? (
          <Empty icon="check" title={t('noTasksAssigned')}
            action={<Button variant="primary" icon="plus" onClick={() => setAssigning(true)}>{t('assignTask')}</Button>} />
        ) : open.map(task => {
          const pr = findPriority(task.priority)
          return (
            <div className="li" key={task.id}>
              <button className="check" onClick={() => toggle(task)} aria-label={t('markComplete')} />
              <div className="body">
                <div className="title">{task.title}</div>
                <div className="meta">
                  {pr && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: pr.color }} />{t(pr.key)}</span>}
                  {task.dueDate && <span>· {relativeDay(task.dueDate, lang)}{task.dueTime ? ` ${fmtTime(task.dueTime, lang)}` : ''}</span>}
                </div>
              </div>
              <button className="iconbtn" style={{ color: 'var(--ok)' }} aria-label={t('nudge')} onClick={() => nudge(task)}><Icon name="whatsapp" size={18} /></button>
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
      {redeem && <RedeemSheet person={person} onClose={() => setRedeem(false)}
        onRedeem={(r, cost) => { awardPoints(person, -cost, people); setRedeem(false); toast.show(`🎁 ${t('redeemedToast')}: ${r.name}`) }} />}
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
