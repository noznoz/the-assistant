import React, { useState, useMemo, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Section, Ring, Stat, Chip, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { greetingKey, fmtLongDate, fmtTime, relativeDay, isToday, isOverdue, daysUntil, money, expenseSar } from '../../lib/format.js'
import { splitReminders } from '../../lib/reminders.js'
import { normalizeQuickActions, quickActionDef } from '../../lib/quickActions.js'
import { hijriDate } from '../../lib/prayer.js'
import { buildBrief } from '../../lib/brief.js'
import { buildDayBrief } from '../../lib/dayBrief.js'
import { nextPrayer, fmtPrayer, findCity } from '../../lib/prayer.js'
import DayBriefSheet from './DayBriefSheet.jsx'
import { buildRenewals } from '../../lib/renewals.js'
import { runRenewalReminders } from '../../lib/notify.js'
import { unreadCount } from '../../lib/notifications.js'
import { useNotificationFeed } from '../../store/useNotificationFeed.js'
import { normalizeDashboard } from '../../lib/dashboard.js'
import PrayerCard from './PrayerCard.jsx'
import QuickCapture from './QuickCapture.jsx'
import { share, formatAgenda } from '../../lib/share.js'
import { findPriority } from '../../lib/domain.js'
import { taskMemberIds } from '../../lib/org.js'
import TaskEditor from '../tasks/TaskEditor.jsx'
import ExpenseEditor from '../expenses/ExpenseEditor.jsx'
import VehicleEditor from '../garage/VehicleEditor.jsx'
import NoteEditor from '../inbox/NoteEditor.jsx'
import SnapFile from '../snap/SnapFile.jsx'

export default function TodayScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const tasks = useCollection('tasks')
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const notes = useCollection('notes')
  const documents = useCollection('documents')
  const people = useCollection('people')
  const valuables = useCollection('valuables')
  const appointments = useCollection('appointments')
  const reminders = useCollection('reminders')
  const staff = useCollection('staff')
  const memberships = useCollection('memberships')
  const properties = useCollection('properties')
  const [editor, setEditor] = useState(null)
  const [dayBrief, setDayBrief] = useState(null)
  const toast = useToast()

  const notifFeed = useNotificationFeed()

  const upcomingReminders = useMemo(() => splitReminders(reminders.items).upcoming, [reminders.items])
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

  // Renewal radar — every expiry across the app, soonest first (red = overdue,
  // amber = due within 30 days).
  const radar = useMemo(() => buildRenewals({
    people: people.items, vehicles: vehicles.items, documents: documents.items,
    memberships: memberships.items, valuables: valuables.items, properties: properties.items, staff: staff.items, t, lang,
  }), [people.items, vehicles.items, documents.items, memberships.items, valuables.items, properties.items, staff.items, lang])
  const radarSoon = radar.filter(x => x.days <= 30) // overdue + due within 30 days
  const radarTint = (d) => d < 0 ? 't-danger' : d <= 30 ? 't-warn' : 't-info'

  // Fire on-device reminders at 30/14/7/1 days before each expiry (deduped).
  useEffect(() => {
    runRenewalReminders(radar, { enabled: settings.notifications, heading: t('renewalReminder') })
  }, [radar, settings.notifications])

  const brief = buildBrief({ tasks: tasks.items, expenses: expenses.items, vehicles: vehicles.items, settings, lang })

  const shareAgenda = () => {
    const todaysExp = expenses.items.filter(e => isToday(e.date))
    share(formatAgenda([...dueToday, ...overdue], todaysExp, lang, settings))
  }

  const closeEditor = (msg) => { setEditor(null); if (msg) toast.show(msg) }

  // Build the full "Start my day" brief on demand (agenda, priorities, money,
  // renewals, next prayer) and open the send/share sheet.
  const openDayBrief = () => {
    const city = findCity(settings.prayerCity)
    const np = nextPrayer(new Date(), city)
    const prayer = { name: t(np.name), time: fmtPrayer(np.date, lang, city.tz) }
    setDayBrief(buildDayBrief({
      tasks: tasks.items, expenses: expenses.items, appointments: appointments.items,
      reminders: reminders.items, renewals: radarSoon, settings, lang, name: settings.name, prayer,
    }))
  }

  const dash = normalizeDashboard(settings.dashboard)
  const quickActionsOn = dash.some(s => s.key === 'quickActions' && s.on)
  const quickActions = normalizeQuickActions(settings.quickActions)
    .filter(q => q.on)
    .map(q => quickActionDef(q.id))
    .filter(Boolean)

  const sectionNodes = {
    brief: (
      <div className="brief">
        <div className="spark"><Icon name="sparkle" size={130} /></div>
        <h3><Icon name="sparkle" size={18} /> {t('morningBrief')}</h3>
        <p>{brief}</p>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" style={{ background: '#fff', color: 'var(--brand-700, #6b4e12)', border: 0, fontWeight: 700 }} onClick={openDayBrief}>
            <Icon name="sparkle" size={16} /> {t('startMyDay')}
          </button>
          <button className="btn sm" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 0 }} onClick={shareAgenda}>
            <Icon name="whatsapp" size={16} /> {t('shareAgenda')}
          </button>
        </div>
      </div>
    ),
    assistant: notifFeed.length > 0 ? (
      <>
        <Section title={t('needsAttention')} count={notifFeed.length}
          action={notifFeed.length > 3 ? t('viewAll') : undefined} onAction={() => go('notifications')} />
        <Card tight>
          {notifFeed.slice(0, 4).map(n => (
            <div className="li" key={n.id} onClick={() => go(n.go)}>
              <div className={`lead ${n.tint}`}><Icon name={n.icon} size={18} /></div>
              <div className="body">
                <div className="title">{n.title}</div>
                <div className="meta">{n.meta}</div>
              </div>
              <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
            </div>
          ))}
        </Card>
      </>
    ) : null,
    reminders: upcomingReminders.length > 0 ? (
      <>
        <Section title={t('reminders')} count={upcomingReminders.length} action={t('view')} onAction={() => go('reminders')} />
        <Card tight>
          {upcomingReminders.slice(0, 4).map(r => (
            <div className="li" key={r.id} onClick={() => go('reminders')}>
              <div className="lead t-brand"><Icon name="bell" size={18} /></div>
              <div className="body">
                <div className="title">{r.text}</div>
                <div className="meta">{relativeDay(r.remindAt, lang)} · {fmtTime(r.remindAt, lang)}</div>
              </div>
              <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
            </div>
          ))}
        </Card>
      </>
    ) : null,
    prayer: <PrayerCard />,
    stats: (
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
    ),
    quickActions: (
      <>
        <Section title={t('quickActions')} />
        <div className="qa-grid">
          {quickActions.map(q => (
            <button key={q.id} className="qa" onClick={() => {
              if (q.id === 'message') { go('message'); return }
              if (q.id === 'reminder') { go('reminders'); return }
              if (q.id === 'voice') { toast.show(t('comingSoon')); return }
              setEditor(q.id)
            }}>
              <span className="ic"><Icon name={q.icon} size={22} /></span>
              {t(q.key)}
            </button>
          ))}
        </div>
      </>
    ),
    work: (() => {
      const workOpen = open.filter(x => x.classification === 'work')
      if (!workOpen.length) return null
      const awaiting = workOpen.filter(x => !x.boss && taskMemberIds(x).length)
      const overdueW = awaiting.filter(x => isOverdue(x.dueDate))
      const fromBoss = workOpen.filter(x => x.boss === 'down')
      const dueSoon = workOpen.filter(x => { const dd = daysUntil(x.dueDate); return dd != null && dd >= 0 && dd <= 7 })
      return (
        <>
          <Section title={t('work')} count={workOpen.length} action={t('view')} onAction={() => go('work')} />
          <Card tight>
            <div className="li" onClick={() => go('followup')}>
              <div className={`lead ${overdueW.length ? 't-danger' : 't-warn'}`}><Icon name="bell" size={18} /></div>
              <div className="body">
                <div className="title">{awaiting.length} {t('awaitingOthers')}</div>
                <div className="meta">
                  {overdueW.length > 0 ? <span className="t-danger">{overdueW.length} {t('overdue')}</span> : <span>{t('onTrack')}</span>}
                  {dueSoon.length > 0 && <span> · {dueSoon.length} {t('dueThisWeek')}</span>}
                  {fromBoss.length > 0 && <span> · {fromBoss.length} {t('fromBoss')}</span>}
                </div>
              </div>
              <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
            </div>
          </Card>
        </>
      )
    })(),
    renewals: radarSoon.length > 0 ? (
      <>
        <Section title={t('expiringSoon')} count={radarSoon.length} action={t('viewAll')} onAction={() => go('renewals')} />
        <Card tight>
          {radarSoon.slice(0, 4).map(it => (
            <div className="li" key={it.id} onClick={() => go(it.go)}>
              <div className={`lead ${radarTint(it.days)}`}><Icon name={it.icon} size={18} /></div>
              <div className="body">
                <div className="title">{it.title}</div>
                <div className="meta">{it.sub}</div>
              </div>
              <Chip tint={radarTint(it.days)}>{it.days < 0 ? t('overdue') : `${it.days}d`}</Chip>
            </div>
          ))}
        </Card>
      </>
    ) : null,
    notes: notes.items.length > 0 ? (
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
    ) : null,
  }

  // Focus style: one urgency-ranked list of everything that needs you now —
  // overdue/today/waiting tasks, due reminders, imminent appointments, payments
  // and birthdays. Expiry/renewal items are deliberately excluded (they keep
  // their own "Expiring soon" card, so Focus doesn't show them twice).
  const focus = settings.homeStyle === 'focus'
  const rightNow = notifFeed.filter(n => n.now)
  const rightNowNode = (
    <>
      <Section title={t('rightNow')} count={rightNow.length || undefined}
        action={notifFeed.length > rightNow.length ? t('viewAll') : undefined} onAction={() => go('notifications')} />
      {rightNow.length === 0 ? (
        <Card tight style={{ textAlign: 'center', padding: '22px 14px' }}>
          <div className="lead t-ok" style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, marginBottom: 8 }}><Icon name="check" size={20} /></div>
          <div style={{ fontWeight: 750 }}>{t('allCaughtUp')}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {upcomingReminders.length ? `${t('next')}: ${upcomingReminders[0].text} · ${relativeDay(upcomingReminders[0].remindAt, lang)}` : t('allCaughtUpHint')}
          </div>
        </Card>
      ) : (
        <Card tight>
          {rightNow.map(n => (
            <div className="li" key={n.id} onClick={() => go(n.go)}>
              <div className={`lead ${n.tint}`}><Icon name={n.icon} size={18} /></div>
              <div className="body">
                <div className="title">{n.title}</div>
                <div className="meta">{n.meta}</div>
              </div>
              <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
            </div>
          ))}
        </Card>
      )}
    </>
  )

  const attentionBlock = (
    <>
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
    </>
  )

  return (
    <>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="sub">{fmtLongDate(new Date(), lang)}{hijriDate(new Date(), lang) ? ` · ${hijriDate(new Date(), lang)}` : ''}</div>
        </div>
        <button className="iconbtn" onClick={() => go('week')} aria-label={t('weekAhead')}><Icon name="calendar" size={18} /></button>
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

        <QuickCapture toast={toast} go={go} />

        {focus ? (
          <>
            {rightNowNode}
            {/* Keep the customizable cards, minus the ones folded into Right now. */}
            {dash.map(({ key, on }) => on && sectionNodes[key] && key !== 'assistant' && key !== 'reminders'
              ? <React.Fragment key={key}>{sectionNodes[key]}</React.Fragment> : null)}
          </>
        ) : (
          <>
            {dash.map(({ key, on }) => on && sectionNodes[key] ? <React.Fragment key={key}>{sectionNodes[key]}{key === 'quickActions' ? attentionBlock : null}</React.Fragment> : null)}
            {!quickActionsOn && attentionBlock}
            {open.length === 0 && overdue.length === 0 && (
              <Card style={{ marginTop: 20, textAlign: 'center' }}>
                <p className="muted">{t('noThingsToday')}</p>
              </Card>
            )}
          </>
        )}

        <button className="link-btn" onClick={() => go('dashboard')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '20px auto 4px', color: 'var(--ink-3)', fontSize: 12.5 }}>
          <Icon name="cog" size={14} /> {t('customizeHome')}
        </button>
      </div>

      {editor === 'task' && <TaskEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'request' && <TaskEditor initial={{ type: 'request', status: 'waiting_someone' }} onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'appointment' && <TaskEditor initial={{ type: 'meeting_action' }} onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'expense' && <ExpenseEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'receipt' && <ExpenseEditor autoScan onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'vehicle' && <VehicleEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'note' && <NoteEditor onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {editor === 'snap' && <SnapFile onClose={closeEditor} onSaved={() => toast.show(t('savedToast'))} />}
      {dayBrief != null && <DayBriefSheet brief={dayBrief} onClose={() => setDayBrief(null)} />}
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
