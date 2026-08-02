import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Sheet, Field, Input, TextArea, Select, Chip, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { PRIORITIES, findPriority, findStatus, ROLE_LEVELS, roleLabel, label } from '../../lib/domain.js'
import { fmtDate, relativeDay, isOverdue, todayISO } from '../../lib/format.js'
import { whatsappToPerson, formatAssignment, formatTaskDetail, emailShare, share } from '../../lib/share.js'
import { teamSize, taskMemberIds, assigneeSummary } from '../../lib/org.js'
import { uid } from '../../store/db.js'
import { pickContacts, contactPickerSupported } from '../../lib/contacts.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

function subProgress(task) {
  const s = task.subtasks || []
  return { total: s.length, done: s.filter(x => x.done).length }
}

// Next due date for a recurring task, advanced from its current due date (or
// today) by the repeat interval.
function nextDueDate(fromISO, repeat) {
  const base = fromISO ? new Date(fromISO + 'T00:00:00') : new Date()
  if (repeat === 'weekly') base.setDate(base.getDate() + 7)
  else if (repeat === 'monthly') base.setMonth(base.getMonth() + 1)
  else if (repeat === 'quarterly') base.setMonth(base.getMonth() + 3)
  else return ''
  return base.toISOString().slice(0, 10)
}

// Mark a work task complete — and, if it repeats, spawn the next occurrence
// with a fresh due date and reset checklist.
function completeWorkTask(task, tasks) {
  tasks.patch(task.id, { status: 'completed' })
  if (task.repeat) {
    const { id, createdAt, updatedAt, ...rest } = task
    const assigned = (Array.isArray(task.memberIds) && task.memberIds.length) || task.memberId || task.boss
    tasks.add({
      ...rest,
      status: assigned ? 'waiting_someone' : 'new',
      dueDate: nextDueDate(task.dueDate, task.repeat),
      subtasks: (task.subtasks || []).map(s => ({ ...s, done: false })),
    })
  }
}

const REPEAT_OPTIONS = ['', 'weekly', 'monthly', 'quarterly']

// A ready-to-send weekly status update for your manager: what got done,
// what's moving, what's stuck, and what you want to raise.
function buildBossUpdate({ tasks, lang, settings, t }) {
  const work = tasks.filter(x => x.classification === 'work')
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const done = work.filter(x => x.status === 'completed' && x.updatedAt && new Date(x.updatedAt) >= weekAgo)
  const progress = work.filter(x => x.status === 'in_progress')
  const blocked = work.filter(x => x.status === 'waiting_someone' || x.status === 'waiting_me')
  const raise = work.filter(x => x.boss === 'up' && x.status !== 'completed' && x.status !== 'cancelled')
  const line = (x, withWho) => `• ${x.title}${withWho && x.assignedTo ? ` (${x.assignedTo})` : ''}${x.dueDate ? ` — ${relativeDay(x.dueDate, lang)}` : ''}`
  const out = [`📊 ${t('statusUpdate')} — ${fmtDate(new Date().toISOString().slice(0, 10), lang, settings.dateFormat)}`, '']
  const block = (label, items, withWho) => { if (items.length) { out.push(label); items.forEach(x => out.push(line(x, withWho))); out.push('') } }
  block(`✅ ${t('completedThisWeek')}`, done, true)
  block(`▶️ ${t('st_in_progress')}`, progress, true)
  block(`⏳ ${t('blockedWaiting')}`, blocked, true)
  block(`🔜 ${t('toRaiseWithYou')}`, raise, false)
  if (out.length <= 2) out.push(t('nothingToReport'))
  return out.join('\n').trim()
}

function BossUpdateSheet({ onClose, toast }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const boss = settings.profile || {}
  const [text, setText] = useState(() => buildBossUpdate({ tasks: tasks.items, lang, settings, t }))
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast && toast.show(t('copied')) } catch { toast && toast.show(text) } }
  return (
    <Sheet title={t('statusUpdate')} onClose={onClose}
      footer={<div className="stack">
        {(boss.managerWhatsapp || boss.managerMobile) && (
          <Button variant="brand" block icon="whatsapp" onClick={() => whatsappToPerson({ whatsapp: boss.managerWhatsapp, mobile: boss.managerMobile }, text)}>
            {t('sendOnWhatsApp')}{boss.managerName ? ` · ${boss.managerName}` : ''}
          </Button>
        )}
        <div className="row2">
          <Button icon="whatsapp" onClick={() => share(text)}>{t('shareWhatsApp')}</Button>
          <Button icon="mail" onClick={() => emailShare(t('statusUpdate'), text)}>{t('email')}</Button>
        </div>
        <Button block icon="doc" onClick={copy}>{t('copy')}</Button>
      </div>}>
      <p className="hint" style={{ margin: '0 2px 8px' }}>{t('statusUpdateHint')}</p>
      <TextArea value={text} onChange={e => setText(e.target.value)} rows={12} style={{ minHeight: 240, fontSize: 14, lineHeight: 1.5 }} />
    </Sheet>
  )
}

// Work / organisation hub: your manager (two-way tasks) + departments, members
// and department tasks assigned to team members. All tasks live in the shared
// `tasks` collection tagged classification:'work'.
export default function WorkScreen({ param, go }) {
  const departments = useCollection('departments')
  if (param) {
    const dep = departments.items.find(d => d.id === param)
    if (dep) return <DepartmentDetail dep={dep} go={go} onBack={() => go('work')} />
  }
  return <WorkHome go={go} />
}

function WorkHome({ go }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const departments = useCollection('departments')
  const members = useCollection('members')
  const tasks = useCollection('tasks')
  const [editDep, setEditDep] = useState(null)
  const [bossTask, setBossTask] = useState(null)   // { boss: 'up'|'down' } or task
  const [bossSheet, setBossSheet] = useState(null)
  const [editBoss, setEditBoss] = useState(false)
  const [bossUpdate, setBossUpdate] = useState(false)
  const toast = useToast()

  const boss = settings.profile?.managerName
  const openWork = tasks.items.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
  const toDiscuss = openWork.filter(x => x.boss === 'up')
  const fromBoss = openWork.filter(x => x.boss === 'down')

  const depCount = (id) => members.items.filter(m => m.departmentId === id).length
  const depOpen = (id) => openWork.filter(x => x.departmentId === id).length
  const waitingOnOthers = openWork.filter(x => !x.boss && taskMemberIds(x).length)
  const waitingOverdue = waitingOnOthers.filter(x => isOverdue(x.dueDate)).length

  return (
    <>
      <DetailHeader title={t('work')} onBack={() => go('more')} right={
        <>
          <button className="iconbtn" onClick={() => go('followup')} aria-label={t('followUps')}><Icon name="bell" size={18} /></button>
          <button className="iconbtn" onClick={() => go('orgchart')} aria-label={t('orgChart')}><Icon name="people" size={18} /></button>
          <button className="iconbtn" onClick={() => go('workboard')} aria-label={t('dashboard')}><Icon name="grid" size={18} /></button>
          <button className="iconbtn" onClick={() => go('meetings')} aria-label={t('meetings')}><Icon name="note" size={18} /></button>
        </>
      } />
      <div className="screen">
        {/* Manager / boss */}
        <Section title={t('myManager')} action={t('edit')} onAction={() => setEditBoss(true)} />
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="lead t-brand" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="people" size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 750 }}>{boss || t('setYourManager')}</div>
              {settings.profile?.managerTitle && <div className="muted" style={{ fontSize: 12.5 }}>{settings.profile.managerTitle}</div>}
            </div>
            {(settings.profile?.managerWhatsapp || settings.profile?.managerMobile) && (
              <button className="iconbtn" aria-label="WhatsApp" onClick={() => whatsappToPerson({ whatsapp: settings.profile.managerWhatsapp, mobile: settings.profile.managerMobile }, '')}><Icon name="whatsapp" size={18} /></button>
            )}
          </div>
          <div className="row2" style={{ marginTop: 12 }}>
            <Button icon="plus" onClick={() => setBossTask({ boss: 'up' })}>{t('toDiscuss')}</Button>
            <Button icon="inbox" onClick={() => setBossTask({ boss: 'down' })}>{t('fromBoss')}</Button>
          </div>
          <Button block icon="report" onClick={() => setBossUpdate(true)} style={{ marginTop: 8 }}>{t('sendStatusUpdate')}</Button>
        </Card>

        {waitingOnOthers.length > 0 && (
          <button onClick={() => go('followup')} style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', color: 'var(--ink)' }}>
            <span className={`lead ${waitingOverdue ? 't-danger' : 't-warn'}`} style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="bell" size={18} /></span>
            <span style={{ flex: 1, textAlign: 'start' }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{t('followUps')}</span>
              <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{waitingOnOthers.length} {t('awaitingOthers')}{waitingOverdue > 0 ? ` · ${waitingOverdue} ${t('overdue')}` : ''}</span>
            </span>
            <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
          </button>
        )}

        {toDiscuss.length > 0 && (
          <>
            <Section title={t('toDiscussWithBoss')} count={toDiscuss.length} />
            <Card tight>{toDiscuss.map(x => <BossRow key={x.id} task={x} lang={lang} settings={settings} onOpen={() => setBossSheet(x)} onDone={() => { completeWorkTask(x, tasks); toast.show('✓') }} />)}</Card>
          </>
        )}
        {fromBoss.length > 0 && (
          <>
            <Section title={t('assignedByBoss')} count={fromBoss.length} />
            <Card tight>{fromBoss.map(x => <BossRow key={x.id} task={x} lang={lang} settings={settings} onOpen={() => setBossSheet(x)} onDone={() => { completeWorkTask(x, tasks); toast.show('✓') }} />)}</Card>
          </>
        )}

        {/* Departments */}
        <Section title={t('departments')} count={departments.items.length} action={t('add')} onAction={() => setEditDep({})} />
        {departments.items.length === 0 ? (
          <Empty icon="report" title={t('noDepartments')} text={t('departmentsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditDep({})}>{t('addDepartment')}</Button>} />
        ) : departments.items.map(d => {
          const head = members.items.find(m => m.id === d.headId)
          return (
            <SwipeRow key={d.id} onEdit={() => setEditDep(d)} onDelete={() => { departments.remove(d.id); toast.show(t('deletedToast')) }}>
              <div className="li" onClick={() => go(`work/${d.id}`)}>
                <div className="lead t-brand"><Icon name="report" size={18} /></div>
                <div className="body">
                  <div className="title">{d.name}</div>
                  <div className="meta">{head ? `${t('head')}: ${head.name}` : t('noHead')} · {depCount(d.id)} {t('membersLower')} · {depOpen(d.id)} {t('tasksLower')}</div>
                </div>
                <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            </SwipeRow>
          )
        })}
      </div>
      <Fab onClick={() => setEditDep({})} />
      {editDep && <DepartmentEditor initial={editDep.id ? editDep : {}} members={members.items} onClose={() => setEditDep(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {bossTask && <WorkTaskEditor mode="boss" initial={bossTask.id ? bossTask : { boss: bossTask.boss }} onClose={() => setBossTask(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {bossSheet && <WorkTaskSheet task={bossSheet} onClose={() => setBossSheet(null)} onEdit={() => { const x = bossSheet; setBossSheet(null); setBossTask(x) }} onSaved={() => toast.show(t('savedToast'))} />}
      {editBoss && <ManagerEditor settings={settings} updateSettings={updateSettings} onClose={() => setEditBoss(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {bossUpdate && <BossUpdateSheet onClose={() => setBossUpdate(false)} toast={toast} />}
      {toast.node}
    </>
  )
}

function BossRow({ task, lang, onOpen, onDone }) {
  const { t } = useT()
  const pr = findPriority(task.priority)
  const overdue = isOverdue(task.dueDate)
  return (
    <div className="li">
      <button className="check" onClick={onDone} aria-label={t('markComplete')} />
      <div className="body" onClick={onOpen}>
        <div className="title">{task.title}</div>
        <div className="meta">
          {pr && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: pr.color }} />{t(pr.key)}</span>}
          {task.dueDate && <span className={overdue ? 't-danger' : ''}>· {relativeDay(task.dueDate, lang)}</span>}
        </div>
      </div>
    </div>
  )
}

function DepartmentDetail({ dep, go, onBack }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const departments = useCollection('departments')
  const members = useCollection('members')
  const tasks = useCollection('tasks')
  const [tab, setTab] = useState('team')
  const [taskView, setTaskView] = useState('list')
  const [editDep, setEditDep] = useState(false)
  const [memEditor, setMemEditor] = useState(null)
  const [taskEditor, setTaskEditor] = useState(null)
  const [taskSheet, setTaskSheet] = useState(null)
  const toast = useToast()

  const team = members.items.filter(m => m.departmentId === dep.id)
  const head = members.items.find(m => m.id === dep.headId)
  const inThisDept = (x) => x.departmentId === dep.id || taskMemberIds(x).some(id => team.some(m => m.id === id))
  const depTasks = tasks.items.filter(x => inThisDept(x) && x.status !== 'cancelled')
    .sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  const memberName = (id) => (members.items.find(m => m.id === id) || {}).name

  return (
    <>
      <DetailHeader title={dep.name} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEditDep(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        {head && (
          <Card style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="lead t-brand" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="flag" size={18} /></span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{head.name}</div><div className="muted" style={{ fontSize: 12.5 }}>{[head.title, t('departmentHead')].filter(Boolean).join(' · ')}</div></div>
            {(head.whatsapp || head.mobile) && <button className="iconbtn" aria-label="WhatsApp" onClick={() => whatsappToPerson(head, '')}><Icon name="whatsapp" size={16} /></button>}
          </Card>
        )}

        <div className="icontabs" style={{ margin: '14px 0' }}>
          {[{ id: 'team', icon: 'people', label: t('team') }, { id: 'tasks', icon: 'check', label: t('tasks') }].map(x => (
            <button key={x.id} className={`icontab ${tab === x.id ? 'on' : ''}`} onClick={() => setTab(x.id)} aria-label={x.label}>
              <Icon name={x.icon} size={20} stroke={tab === x.id ? 2.3 : 1.9} /><span className="cap">{x.label}</span>
            </button>
          ))}
        </div>

        {tab === 'team' && (
          <>
            <Section title={t('orgChart')} count={team.length} action={t('addMember')} onAction={() => setMemEditor({})} />
            {team.length === 0 ? (
              <Empty icon="people" title={t('noMembers')} text={t('orgHint')}
                action={<Button variant="primary" icon="plus" onClick={() => setMemEditor({})}>{t('addMember')}</Button>} />
            ) : (
              <Card tight>
                <OrgTree team={team} dep={dep} depth={0} parentId="" members={members} departments={departments}
                  onEdit={(m) => setMemEditor(m)} onAddReport={(id) => setMemEditor({ reportsToId: id })} toast={toast} />
              </Card>
            )}
            <p className="hint" style={{ marginTop: 10 }}>{t('orgFooter')}</p>
          </>
        )}

        {tab === 'tasks' && (
          <>
            <Section title={t('departmentTasks')} count={depTasks.length} action={t('add')} onAction={() => setTaskEditor({})} />
            {depTasks.length > 0 && (
              <div className="chip-row" style={{ marginBottom: 10 }}>
                <Chip selectable on={taskView === 'list'} onClick={() => setTaskView('list')}><Icon name="check" size={13} /> {t('listView')}</Chip>
                <Chip selectable on={taskView === 'board'} onClick={() => setTaskView('board')}><Icon name="grid" size={13} /> {t('boardView')}</Chip>
              </div>
            )}
            {depTasks.length === 0 ? (
              <Empty icon="check" title={t('nothingHere')} text={t('assignTaskHint')}
                action={<Button variant="primary" icon="plus" onClick={() => setTaskEditor({})}>{t('newTask')}</Button>} />
            ) : taskView === 'board' ? (
              <WorkBoard tasks={depTasks} lang={lang} tasksCol={tasks} onOpen={setTaskSheet} />
            ) : depTasks.map(x => {
              const pr = findPriority(x.priority)
              const done = x.status === 'completed'
              const overdue = !done && isOverdue(x.dueDate)
              return (
                <SwipeRow key={x.id} onEdit={() => setTaskEditor(x)} onDelete={() => { tasks.remove(x.id); toast.show(t('deletedToast')) }}>
                  <div className={`li ${done ? 'done' : ''}`}>
                    <button className={`check ${done ? 'on' : ''}`} onClick={() => done ? tasks.patch(x.id, { status: 'new' }) : completeWorkTask(x, tasks)} aria-label={t('markComplete')}>
                      {done && <Icon name="check" size={16} stroke={3} />}
                    </button>
                    <div className="body" onClick={() => setTaskSheet(x)}>
                      <div className="title">{x.title}</div>
                      <div className="meta">
                        {x.assignedTo && <span>{x.assignedTo}</span>}
                        {pr && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>· <span style={{ width: 7, height: 7, borderRadius: 4, background: pr.color }} />{t(pr.key)}</span>}
                        {x.dueDate && <span className={overdue ? 't-danger' : ''}>· {relativeDay(x.dueDate, lang)}</span>}
                        {(() => { const p = subProgress(x); return p.total > 0 ? <span>· ☑ {p.done}/{p.total}</span> : null })()}
                        {x.repeat && <span>· ↻ {t(x.repeat)}</span>}
                      </div>
                    </div>
                    {(() => { const asg = members.items.find(mm => mm.id === x.memberId); return asg && (asg.whatsapp || asg.mobile) ? <button className="iconbtn" aria-label="WhatsApp" onClick={() => whatsappToPerson(asg, formatAssignment(x, asg, lang, settings))}><Icon name="whatsapp" size={16} /></button> : null })()}
                  </div>
                </SwipeRow>
              )
            })}
          </>
        )}
      </div>
      <Fab onClick={() => tab === 'tasks' ? setTaskEditor({}) : setMemEditor({})} />
      {editDep && <DepartmentEditor initial={dep} members={team} onClose={() => setEditDep(false)} onSaved={() => toast.show(t('savedToast'))} onDeleted={onBack} />}
      {memEditor && <MemberEditor departmentId={dep.id} team={team} initial={memEditor} onClose={() => setMemEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {taskEditor && <WorkTaskEditor mode="dept" departmentId={dep.id} members={team} initial={taskEditor.id ? taskEditor : {}} onClose={() => setTaskEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {taskSheet && <WorkTaskSheet task={taskSheet} department={dep} members={team} onClose={() => setTaskSheet(null)} onEdit={() => { const x = taskSheet; setTaskSheet(null); setTaskEditor(x) }} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

// Kanban board: one column per status, cards move between columns with the
// chevron buttons (drag isn't reliable on touch, so tap-to-move is used).
function WorkBoard({ tasks, lang, tasksCol, onOpen }) {
  const { t } = useT()
  const cols = WORK_STATUSES
  const idx = (s) => Math.max(0, cols.indexOf(s || 'new'))
  const move = (task, dir) => {
    const ni = Math.min(cols.length - 1, Math.max(0, idx(task.status) + dir))
    const ns = cols[ni]
    if (ns === task.status) return
    if (ns === 'completed') completeWorkTask(task, tasksCol)
    else tasksCol.patch(task.id, { status: ns })
  }
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
      {cols.map(s => {
        const items = tasks.filter(x => (x.status || 'new') === s)
        return (
          <div key={s} style={{ minWidth: 176, flex: '0 0 176px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', margin: '0 2px 8px' }}>
              <span>{t('st_' + s)}</span><span className="chip">{items.length}</span>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {items.map(x => {
                const pr = findPriority(x.priority)
                const overdue = x.status !== 'completed' && isOverdue(x.dueDate)
                return (
                  <div key={x.id} className="card tight" style={{ padding: 10 }}>
                    <div onClick={() => onOpen(x)}>
                      <div style={{ fontWeight: 650, fontSize: 14 }}>{x.title}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                        {[x.assignedTo, x.dueDate && relativeDay(x.dueDate, lang)].filter(Boolean).join(' · ')}
                        {overdue && <span className="t-danger"> · {t('overdue')}</span>}
                        {x.repeat && <span> · ↻</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <button className="iconbtn" aria-label={t('moveBack')} disabled={idx(s) === 0} style={{ opacity: idx(s) === 0 ? 0.3 : 1 }} onClick={() => move(x, -1)}><Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
                      {pr && <span style={{ width: 8, height: 8, borderRadius: 4, background: pr.color }} />}
                      <button className="iconbtn" aria-label={t('moveForward')} disabled={idx(s) === cols.length - 1} style={{ opacity: idx(s) === cols.length - 1 ? 0.3 : 1 }} onClick={() => move(x, 1)}><Icon name="chevron" size={16} /></button>
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && <div className="muted" style={{ fontSize: 12, textAlign: 'center', padding: '8px 0' }}>—</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DepartmentEditor({ initial, members = [], onClose, onSaved, onDeleted }) {
  const { t } = useT()
  const departments = useCollection('departments')
  const [f, setF] = useState({ name: '', headId: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() }
    initial.id ? departments.save({ ...rec, id: initial.id }) : departments.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editDepartment') : t('addDepartment')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { departments.remove(initial.id); onClose(); onDeleted && onDeleted() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('departmentName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder={t('departmentPlaceholder')} autoFocus /></Field>
      {members.length > 0 && (
        <Field label={t('departmentHead')} hint={t('optional')}>
          <Select value={f.headId} onChange={set('headId')}>
            <option value="">{t('none')}</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}

// Renders the reporting hierarchy: managers with their direct reports nested
// beneath, recursively. A "+" under anyone adds a direct report to them.
function OrgTree({ team, dep, depth = 0, parentId = '', members, departments, onEdit, onAddReport, toast }) {
  const { t, lang } = useT()
  // Roots at depth 0 = members with no manager (or a manager outside the team).
  const nodes = depth === 0
    ? team.filter(m => !m.reportsToId || !team.some(x => x.id === m.reportsToId))
    : team.filter(m => m.reportsToId === parentId)
  return nodes.map(m => (
    <React.Fragment key={m.id}>
      <div className="li" style={{ marginInlineStart: depth * 16 }}>
        {depth > 0 && <span style={{ width: 10, color: 'var(--ink-3)', flexShrink: 0 }}>└</span>}
        <div className={`lead ${dep.headId === m.id ? 't-brand' : ''}`} style={{ background: dep.headId === m.id ? undefined : 'var(--surface-2)' }}><Icon name={dep.headId === m.id ? 'flag' : 'people'} size={17} /></div>
        <div className="body" onClick={() => onEdit(m)}>
          <div className="title">{m.name}{dep.headId === m.id ? ` · ${t('head')}` : ''}</div>
          <div className="meta">{[m.title, roleLabel(m, lang), m.mobile].filter(Boolean).join(' · ')}</div>
        </div>
        {(() => { const n = teamSize(m.id, team); return n > 0 ? <span className="chip" title={t('teamSizeLabel')}>{n}</span> : null })()}
        <button className="iconbtn" aria-label={t('addReport')} onClick={() => onAddReport(m.id)}><Icon name="plus" size={16} /></button>
        {(m.whatsapp || m.mobile) && <button className="iconbtn" aria-label="WhatsApp" onClick={() => whatsappToPerson(m, '')}><Icon name="whatsapp" size={16} /></button>}
      </div>
      <OrgTree team={team} dep={dep} depth={depth + 1} parentId={m.id} members={members} departments={departments} onEdit={onEdit} onAddReport={onAddReport} toast={toast} />
    </React.Fragment>
  ))
}

function MemberEditor({ departmentId, team = [], initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const members = useCollection('members')
  const departments = useCollection('departments')
  const youName = (settings.profile || {}).fullName || settings.name || t('me')
  // Default a brand-new person's level to Officer unless it's the first (Head).
  const defaultRole = initial.id ? '' : (team.length === 0 ? 'head' : 'officer')
  const [f, setF] = useState({ name: '', title: '', role: defaultRole, mobile: '', whatsapp: '', email: '', reportsToId: '', departmentId, ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const managers = team.filter(m => m.id !== initial.id)
  const fromContacts = async () => {
    const [c] = await pickContacts({ multiple: false })
    if (c) setF(prev => ({ ...prev, name: c.name || prev.name, mobile: c.mobile || prev.mobile, whatsapp: c.mobile || prev.whatsapp, email: c.email || prev.email }))
  }
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), departmentId }
    const saved = initial.id ? members.save({ ...rec, id: initial.id }) : members.add(rec)
    // Choosing the "Head" level (or being the first member) sets the department head.
    if (f.role === 'head' || (!initial.id && !f.reportsToId && team.length === 0)) departments.patch(departmentId, { headId: saved.id })
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editMember') : t('addMember')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { members.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      {!initial.id && contactPickerSupported() && (
        <Button block icon="download" onClick={fromContacts} style={{ marginBottom: 12 }}>{t('fromContacts')}</Button>
      )}
      <Field label={t('name')} required error={err}><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label={t('jobTitle')} hint={t('optional')}><Input value={f.title} onChange={set('title')} placeholder={t('rolePlaceholder')} /></Field>
      <div className="row2">
        <Field label={t('level')}>
          <Select value={f.role} onChange={set('role')} options={ROLE_LEVELS.map(r => ({ value: r.id, label: label(r, lang) }))} />
        </Field>
        <Field label={t('reportsTo')}>
          <Select value={f.reportsToId} onChange={set('reportsToId')}>
            <option value="">{t('reportsToYou')} — {youName}</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="row2">
        <Field label={t('mobile')}><Input value={f.mobile} onChange={set('mobile')} inputMode="tel" placeholder="+9665…" /></Field>
        <Field label={t('whatsapp')}><Input value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="+9665…" /></Field>
      </div>
      <Field label={t('email')} hint={t('optional')}><Input value={f.email} onChange={set('email')} inputMode="email" /></Field>
    </Sheet>
  )
}

function ManagerEditor({ settings, updateSettings, onClose, onSaved }) {
  const { t } = useT()
  const p = settings.profile || {}
  const [f, setF] = useState({ managerName: p.managerName || '', managerTitle: p.managerTitle || '', managerMobile: p.managerMobile || '', managerWhatsapp: p.managerWhatsapp || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => { updateSettings({ profile: { ...p, ...f } }); onSaved && onSaved(); onClose() }
  return (
    <Sheet title={t('myManager')} onClose={onClose}
      footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <Field label={t('name')}><Input value={f.managerName} onChange={set('managerName')} autoFocus /></Field>
      <Field label={t('jobTitle')} hint={t('optional')}><Input value={f.managerTitle} onChange={set('managerTitle')} /></Field>
      <div className="row2">
        <Field label={t('mobile')}><Input value={f.managerMobile} onChange={set('managerMobile')} inputMode="tel" placeholder="+9665…" /></Field>
        <Field label={t('whatsapp')}><Input value={f.managerWhatsapp} onChange={set('managerWhatsapp')} inputMode="tel" placeholder="+9665…" /></Field>
      </div>
    </Sheet>
  )
}

function WorkTaskSheet({ task, department, members = [], onClose, onEdit, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const allMembers = useCollection('members')
  const live = tasks.items.find(x => x.id === task.id) || task
  const subs = live.subtasks || []
  const assignees = allMembers.items.filter(m => taskMemberIds(live).includes(m.id))
  const pr = findPriority(live.priority)
  const st = findStatus(live.status)
  const done = live.status === 'completed'

  const toggleSub = (id) => tasks.patch(live.id, { subtasks: subs.map(s => s.id === id ? { ...s, done: !s.done } : s) })
  const detail = () => formatTaskDetail(live, lang, settings, { department: department?.name })

  return (
    <Sheet title={live.title} onClose={onClose}>
      <div className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        {[department?.name, live.assignedTo, pr && t(pr.key), st && t(st.key)].filter(Boolean).join(' · ')}
      </div>
      {live.description && <p style={{ marginBottom: 14 }}>{live.description}</p>}
      {live.dueDate && <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}><Icon name="calendar" size={13} /> {t('deadline')}: {fmtDate(live.dueDate, lang, settings.dateFormat)}</p>}

      {subs.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '2px 2px 6px' }}>{t('checklist')} · {subs.filter(s => s.done).length}/{subs.length}</div>
          <div style={{ marginBottom: 14 }}>
            {subs.map(s => (
              <div key={s.id} className="li" style={{ margin: 0 }}>
                <button className={`check ${s.done ? 'on' : ''}`} onClick={() => toggleSub(s.id)} aria-label={t('markComplete')}>{s.done && <Icon name="check" size={14} stroke={3} />}</button>
                <div className="body"><div className="title" style={{ fontSize: 14, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>{s.text}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="stack">
        <Button block icon="check" onClick={() => { done ? tasks.patch(live.id, { status: 'new' }) : completeWorkTask(live, tasks); onSaved && onSaved(); onClose() }}>{done ? t('st_new') : t('markComplete')}</Button>
        {assignees.filter(a => a.whatsapp || a.mobile).map(a => (
          <Button key={a.id} block variant="brand" icon="whatsapp" onClick={() => whatsappToPerson(a, detail())}>{t('sendOnWhatsApp')} · {a.name}</Button>
        ))}
        <div className="row2">
          <Button icon="whatsapp" onClick={() => share(detail())}>{t('shareWhatsApp')}</Button>
          <Button icon="mail" onClick={() => emailShare(live.title, detail())}>{t('email')}</Button>
        </div>
        <div className="row2">
          <Button icon="edit" onClick={onEdit}>{t('edit')}</Button>
          <Button variant="danger" icon="trash" onClick={() => { tasks.remove(live.id); onClose() }}>{t('delete')}</Button>
        </div>
      </div>
    </Sheet>
  )
}

const WORK_STATUSES = ['new', 'in_progress', 'waiting_someone', 'waiting_me', 'completed']

function WorkTaskEditor({ mode, departmentId, members = [], initial, onClose, onSaved }) {
  const { t } = useT()
  const tasks = useCollection('tasks')
  const allMembers = useCollection('members')
  const departments = useCollection('departments')
  const [f, setF] = useState({
    title: '', description: '', dueDate: '', priority: 'medium', status: 'new',
    memberId: '', boss: '', classification: 'work', subtasks: [], repeat: '', ...initial,
  })
  const [memberIds, setMemberIds] = useState(() => taskMemberIds(initial))
  const [err, setErr] = useState('')
  const [subText, setSubText] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const subs = f.subtasks || []
  const addSub = () => { const v = subText.trim(); if (!v) return; setF({ ...f, subtasks: [...subs, { id: uid(), text: v, done: false }] }); setSubText('') }
  const toggleSub = (id) => setF({ ...f, subtasks: subs.map(s => s.id === id ? { ...s, done: !s.done } : s) })
  const removeSub = (id) => setF({ ...f, subtasks: subs.filter(s => s.id !== id) })

  // Assignment: pick any number of members across any department. Tapping a
  // department's "Everyone" chip toggles all of its members at once.
  const toggleMember = (id) => setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const deptMemberIds = (depId) => allMembers.items.filter(m => m.departmentId === depId).map(m => m.id)
  const deptAllOn = (depId) => { const ids = deptMemberIds(depId); return ids.length > 0 && ids.every(id => memberIds.includes(id)) }
  const toggleDept = (depId) => {
    const ids = deptMemberIds(depId)
    setMemberIds(prev => deptAllOn(depId) ? prev.filter(x => !ids.includes(x)) : [...new Set([...prev, ...ids])])
  }
  // Departments shown: the current one first, then the rest (for cross-dept).
  const orderedDepts = mode === 'dept'
    ? [...departments.items.filter(d => d.id === departmentId), ...departments.items.filter(d => d.id !== departmentId)]
    : departments.items

  const submit = () => {
    if (!f.title.trim()) { setErr(t('required')); return }
    const summary = mode === 'boss'
      ? (f.assignedTo || '')
      : assigneeSummary({ memberIds }, allMembers.items, departments.items)
    // Primary department: keep the editor's dept, else the first assignee's.
    const firstMember = allMembers.items.find(m => m.id === memberIds[0])
    const rec = {
      ...f, title: f.title.trim(), classification: 'work',
      memberIds, memberId: memberIds[0] || '',
      departmentId: mode === 'dept' ? departmentId : (f.departmentId || (firstMember ? firstMember.departmentId : '')),
      assignedTo: summary,
      status: mode !== 'boss' && memberIds.length && f.status === 'new' ? 'waiting_someone' : f.status,
    }
    initial.id ? tasks.save({ ...rec, id: initial.id }) : tasks.add(rec)
    onSaved && onSaved(); onClose()
  }
  const title = mode === 'boss'
    ? (f.boss === 'down' ? t('assignedByBoss') : t('toDiscussWithBoss'))
    : (initial.id ? t('editTask') : t('newTask'))
  return (
    <Sheet title={title} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { tasks.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('appointmentTitle')} required error={err}><Input value={f.title} onChange={set('title')} placeholder={t('taskPlaceholder')} autoFocus /></Field>
      <Field label={t('description')}><TextArea value={f.description} onChange={set('description')} placeholder={t('descriptionPlaceholder')} /></Field>
      {mode !== 'boss' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '0 2px 7px' }}>
            <span>{t('assignTo')}</span>
            <span className="muted" style={{ fontWeight: 500 }}>{memberIds.length ? `${memberIds.length} ${t('selected')}` : t('unassigned')}</span>
          </label>
          {orderedDepts.map(dep => {
            const dm = allMembers.items.filter(m => m.departmentId === dep.id)
            if (!dm.length) return null
            return (
              <div key={dep.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 2px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{dep.name}</span>
                  <Chip selectable on={deptAllOn(dep.id)} onClick={() => toggleDept(dep.id)}>
                    <Icon name="people" size={12} /> {t('everyone')}
                  </Chip>
                </div>
                <div className="chip-row">
                  {dm.map(m => (
                    <Chip key={m.id} selectable on={memberIds.includes(m.id)} onClick={() => toggleMember(m.id)}>
                      {memberIds.includes(m.id) && <Icon name="check" size={12} stroke={3} />} {m.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="hint" style={{ margin: '4px 2px 0' }}>{t('assignMultiHint')}</p>
        </div>
      )}
      {mode === 'boss' && (
        <Field label={t('direction')}>
          <Select value={f.boss} onChange={set('boss')} options={[
            { value: 'up', label: t('toDiscussWithBoss') },
            { value: 'down', label: t('assignedByBoss') },
          ]} />
        </Field>
      )}
      <div className="row2">
        <Field label={t('deadline')}><Input type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
        <Field label={t('status')}>
          <Select value={f.status} onChange={set('status')} options={WORK_STATUSES.map(s => ({ value: s, label: t('st_' + s) }))} />
        </Field>
      </div>
      <Field label={t('repeat')} hint={t('repeatHint')}>
        <Select value={f.repeat} onChange={set('repeat')} options={REPEAT_OPTIONS.map(r => ({ value: r, label: r ? t(r) : t('off') }))} />
      </Field>
      <div style={{ marginTop: 4 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '0 2px 7px' }}>{t('priority')}</label>
        <div className="chip-row">
          {PRIORITIES.map(p => <Chip key={p.id} selectable on={f.priority === p.id} onClick={() => setF({ ...f, priority: p.id })}>{t(p.key)}</Chip>)}
        </div>
      </div>

      {/* Checklist / sub-tasks */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', margin: '14px 2px 7px' }}>
        {t('checklist')}{subs.length ? ` · ${subs.filter(s => s.done).length}/${subs.length}` : ''}
      </label>
      {subs.map(s => (
        <div key={s.id} className="li" style={{ margin: 0 }}>
          <button className={`check ${s.done ? 'on' : ''}`} onClick={() => toggleSub(s.id)} aria-label={t('markComplete')}>
            {s.done && <Icon name="check" size={14} stroke={3} />}
          </button>
          <div className="body"><div className="title" style={{ fontSize: 14, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>{s.text}</div></div>
          <button className="iconbtn" aria-label={t('delete')} onClick={() => removeSub(s.id)}><Icon name="x" size={15} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <Input value={subText} onChange={e => setSubText(e.target.value)} placeholder={t('addSubtask')} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }} style={{ flex: 1 }} />
        <Button icon="plus" onClick={addSub}>{t('add')}</Button>
      </div>
    </Sheet>
  )
}
