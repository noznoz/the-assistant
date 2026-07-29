import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Section, Ring, Stat, Chip, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { greetingKey, fmtLongDate, isToday, isOverdue, daysUntil, money, expenseSar } from '../../lib/format.js'
import { hijriDate } from '../../lib/prayer.js'
import { buildBrief } from '../../lib/brief.js'
import { buildNotificationFeed, unreadCount } from '../../lib/notifications.js'
import PrayerCard from './PrayerCard.jsx'
import { share, formatAgenda } from '../../lib/share.js'
import { findPriority } from '../../lib/domain.js'
import TaskEditor from '../tasks/TaskEditor.jsx'
import ExpenseEditor from '../expenses/ExpenseEditor.jsx'
import VehicleEditor from '../garage/VehicleEditor.jsx'
import NoteEditor from '../inbox/NoteEditor.jsx'

const QUICK = [
  { id: 'task', key: 'addTask', icon: 'check' },
  { id: 'request', key: 'addRequest', icon: 'inbox' },
  { id: 'expense', key: 'addExpense', icon: 'wallet' },
  { id: 'note', key: 'addNote', icon: 'note' },
  { id: 'message', key: 'sendMessage', icon: 'whatsapp' },
  { id: 'appointment', key: 'addAppointment', icon: 'calendar' },
  { id: 'vehicle', key: 'addVehicle', icon: 'car' },
  { id: 'receipt', key: 'scanReceipt', icon: 'receipt' },
]

export default function TodayScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const notes = useCollection('notes')
  const services = useCollection('services')
  const documents = useCollection('documents')
  const subscriptions = useCollection('subscriptions')
  const people = useCollection('people')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const notifFeed = useMemo(() => buildNotificationFeed({
    tasks: tasks.items, vehicles: vehicles.items, services: services.items,
    docs: documents.items, subs: subscriptions.items, people: people.items, t, lang, settings,
  }), [tasks.items, vehicles.items, services.items, documents.items, subscriptions.items, people.items, lang])
  const unread = unreadCount(notifFeed, settings.notificationsSeen)

  const open = tasks.items.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
  const dueToday = open.filter(x => isToday(x.dueDate))
  const overdue = open.filter(x => isOverdue(x.dueDate))
  const waitingMe = open.filter(x => x.status === 'waiting_me')
  const delegated = open.filter(x => x.status === 'waiting_someone')
  const highPri = open.filter(x => x.priority === 'critical' || x.priority === 'high')

  const completedToday = tasks.items.filter(x => x.status === 'completed')
  const progress = useMemo(() => {
    const todayScope = [...dueToday, ...completedToday.filter(x => isToday(x.updatedAt))]
    const total = todayScope.length || 1
    const done = todayScope.filter(x => x.status === 'completed').length
    return { done, total, pct: done / total }
  }, [dueToday, completedToday])

  const cur = settings.currency
  const spentToday = expenses.items.filter(e => isToday(e.date)).reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const spentMonth = expenses.items.filter(e => new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
    .reduce((s, e) => s + expenseSar(e, settings.rates), 0)

  const renewals = vehicles.items
    .map(v => ({ v, dd: daysUntil(v.policyExpiry) }))
    .filter(x => x.dd != null && x.dd <= 45)
    .sort((a, b) => a.dd - b.dd)

  const brief = buildBrief({ tasks: tasks.items, expenses: expenses.items, vehicles: vehicles.items, settings, lang })

  const shareAgenda = () => {
    const todaysExp = expenses.items.filter(e => isToday(e.date))
    share(formatAgenda([...dueToday, ...overdue], todaysExp, lang, settings))
  }

  const closeEditor = (msg) => { setEditor(null); if (msg) toast.show(msg) }

  return (
    <>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="sub">{fmtLongDate(new Date(), lang)}{hijriDate(new Date(), lang) ? ` · ${hijriDate(new Date(), lang)}` : ''}</div>
        </div>
        <button className="iconbtn" onClick={() => go('notifications')} aria-label={t('notifications')} style={{ position: 'relative' }}>
          <Icon name="bell" size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: 2, insetInlineEnd: 2, minWidth: 17, height: 17, padding: '0 4px',
              borderRadius: 9, background: 'var(--danger)', color: '#fff', fontSize: 10.5, fontWeight: 750,
              display: 'grid', placeItems: 'center', border: '2px solid var(--bg)', lineHeight: 1,
            }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
        <button className="iconbtn" onClick={() => go('search')} aria-label={t('search')}><Icon name="search" size={18} /></button>
      </div>

      <div className="screen">
        <div className="hero">
          <div className="greet">{t(greetingKey())}{settings.name ? ',' : ''}</div>
          <h1>{settings.name || 'The Assistant'}</h1>
        </div>

        {/* Morning brief */}
        <div className="brief">
          <div className="spark"><Icon name="sparkle" size={130} /></div>
          <h3><Icon name="sparkle" size={18} /> {t('morningBrief')}</h3>
          <p>{brief}</p>
          <div style={{ marginTop: 14 }}>
            <button className="btn sm" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 0 }} onClick={shareAgenda}>
              <Icon name="whatsapp" size={16} /> {t('shareAgenda')}
            </button>
          </div>
        </div>

        <PrayerCard />

        {/* Progress + stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, marginTop: 14, alignItems: 'stretch' }}>
          <Card tight style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
            <Ring value={progress.pct}>{Math.round(progress.pct * 100)}%</Ring>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{t('dailyProgress')}</div>
          </Card>
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 12 }}>
            <Stat label={t('todaysSpending')} value={money(spentToday, cur, lang)} onClick={() => go('expenses')} />
            <Stat label={t('monthlyTotal')} value={money(spentMonth, cur, lang)} onClick={() => go('expenses')} />
          </div>
        </div>

        {/* Quick actions */}
        <Section title={t('quickActions')} />
        <div className="qa-grid">
          {QUICK.map(q => (
            <button key={q.id} className="qa" onClick={() => {
              if (q.id === 'message') { go('message'); return }
              if (q.id === 'receipt' || q.id === 'voice') { toast.show(t('comingSoon')); return }
              setEditor(q.id)
            }}>
              <span className="ic"><Icon name={q.icon} size={22} /></span>
              {t(q.key)}
            </button>
          ))}
        </div>

        {/* Attention lists */}
        {overdue.length > 0 && <AttentionCard tint="t-danger" icon="clock" title={t('overdue')} items={overdue} go={go} lang={lang} />}
        {waitingMe.length > 0 && <AttentionCard tint="t-warn" icon="flag" title={t('waitingForMe')} items={waitingMe} go={go} lang={lang} />}
        {dueToday.length > 0 && <AttentionCard tint="t-info" icon="today" title={t('todaysTasks')} items={dueToday} go={go} lang={lang} />}
        {highPri.length > 0 && dueToday.length === 0 && overdue.length === 0 &&
          <AttentionCard tint="t-brand" icon="flag" title={t('highPriority')} items={highPri} go={go} lang={lang} />}

        {delegated.length > 0 && (
          <>
            <Section title={t('delegated')} count={delegated.length} action={t('view')} onAction={() => go('tasks/delegated')} />
            <Card tight>{delegated.slice(0, 3).map(x => <MiniRow key={x.id} task={x} lang={lang} />)}</Card>
          </>
        )}

        {/* Renewals / maintenance */}
        {renewals.length > 0 && (
          <>
            <Section title={t('renewals')} count={renewals.length} />
            {renewals.slice(0, 3).map(({ v, dd }) => (
              <div className="li" key={v.id} onClick={() => go(`garage/${v.id}`)}>
                <div className="lead t-warn"><Icon name="shield" size={20} /></div>
                <div className="body">
                  <div className="title">{v.nickname || v.name}</div>
                  <div className="meta">{t('insurance')} · {v.insuranceCompany}</div>
                </div>
                <Chip tint={dd <= 14 ? 't-danger' : 't-warn'}>{dd}d</Chip>
              </div>
            ))}
          </>
        )}

        {/* Quick notes */}
        {notes.items.length > 0 && (
          <>
            <Section title={t('quickNotes')} count={notes.items.length} action={t('view')} onAction={() => go('notes')} />
            <Card tight className="stack">
              {notes.items.slice(0, 3).map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="note" size={16} style={{ marginTop: 2, color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 14 }}>{n.text}</span>
                </div>
              ))}
            </Card>
          </>
        )}

        {open.length === 0 && overdue.length === 0 && (
          <Card style={{ marginTop: 20, textAlign: 'center' }}>
            <p className="muted">{t('noThingsToday')}</p>
          </Card>
        )}
      </div>

      {editor === 'task' && <TaskEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'request' && <TaskEditor initial={{ type: 'request', status: 'waiting_someone' }} onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'appointment' && <TaskEditor initial={{ type: 'meeting_action' }} onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'expense' && <ExpenseEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'vehicle' && <VehicleEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'note' && <NoteEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function AttentionCard({ tint, icon, title, items, go, lang }) {
  return (
    <>
      <Section title={title} count={items.length} />
      <div>
        {items.slice(0, 5).map(x => <MiniRow key={x.id} task={x} lang={lang} icon={icon} tint={tint} onClick={() => go('tasks')} />)}
      </div>
    </>
  )
}

function MiniRow({ task, lang, icon = 'check', tint = 't-info', onClick }) {
  const pr = findPriority(task.priority)
  return (
    <div className="li" onClick={onClick}>
      <div className={`lead ${tint}`}><Icon name={icon} size={18} /></div>
      <div className="body">
        <div className="title">{task.title}</div>
        {(task.assignedTo || task.project) && <div className="meta">{task.assignedTo || task.project}</div>}
      </div>
      {pr && <span className="dot" style={{ width: 9, height: 9, borderRadius: 5, background: pr.color }} />}
    </div>
  )
}
