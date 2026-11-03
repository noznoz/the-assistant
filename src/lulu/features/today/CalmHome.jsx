import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { Section, Button, Pressable } from '../../ui/primitives.jsx'
import { money, fmtTime, relativeDay, isOverdue } from '../../lib/format.js'
import { prayerTimes, countdown } from '../../lib/prayer.js'

// The redesigned Today ("Calm" layout). It answers four questions, in order:
// what's next, what does my day look like, what needs me, how's my money.
// Everything else stays one tap away (the + button, the tabs, More).

const KIND_ICON = { prayer: 'moon', appt: 'calendar', rem: 'bell' }
const atOf = (a) => (a.date && a.time ? new Date(`${a.date.slice(0, 10)}T${a.time}:00`) : null)

export default function CalmHome({ data, go, t, lang, city, notifFeed, shareAgenda, openTask }) {
  const now = new Date()
  const cur = data.cur
  const m = (v) => money(v, cur, lang)
  const kindLabel = { prayer: t('kindPrayer'), appt: t('cap_appointment'), rem: t('cap_reminder') }

  // ---- The day as one timeline: appointments, reminders and the five prayers.
  const events = []
  prayerTimes(now, city).forEach(p => events.push({
    key: 'p-' + p.name, at: p.date, time: fmtTime(p.date, lang), kind: 'prayer', title: t(p.name), go: 'spiritual',
  }))
  data.appts.forEach(a => {
    const at = atOf(a)
    events.push({ key: 'a-' + a.id, at, time: at ? fmtTime(at, lang) : t('allDay'), kind: 'appt', title: a.title || t('cap_appointment'), sub: a.location || '', go: 'appointments' })
  })
  data.rems.forEach(r => {
    const at = new Date(r.remindAt)
    events.push({ key: 'r-' + r.id, at, time: fmtTime(at, lang), kind: 'rem', title: r.text, go: 'reminders' })
  })
  // Untimed (all-day) appointments lead the day.
  events.sort((x, y) => (x.at ? x.at.getTime() : -1) - (y.at ? y.at.getTime() : -1))
  const isPast = (e) => e.at && e.at <= now
  const nowAt = events.findIndex(e => e.at && e.at > now)          // "Now" sits before this row
  const nextPrayer = events.find(e => e.kind === 'prayer' && e.at > now)

  // ---- Next up: the next timed meeting or reminder; else the top task.
  const nextEv = events.find(e => e.kind !== 'prayer' && e.at && e.at > now)
  const task = nextEv ? null : data.priorityTask

  // ---- One-line summary of the day.
  const parts = []
  const nMeet = data.appts.length, { due, overdue } = data.counts
  if (nMeet) parts.push(<span key="m"><b>{nMeet}</b> {nMeet === 1 ? t('sumMeeting') : t('sumMeetings')}</span>)
  if (due) parts.push(<span key="d"><b>{due}</b> {due === 1 ? t('sumTaskDue') : t('sumTasksDue')}</span>)
  if (overdue) parts.push(<span key="o"><b>{overdue}</b> {t('sumOverdue')}</span>)
  if (data.prayer && data.prayer.date) {
    parts.push(<span key="p" className="nb">{data.prayer.name} {t('inTime')} {countdown(data.prayer.date, now, lang)}</span>)
  }

  const budget = Number(data.budget) || 0
  const left = budget - data.spentMonth
  const pct = budget > 0 ? Math.min(100, Math.round((data.spentMonth / budget) * 100)) : 0

  return (
    <div className="calm">
      <h1 className="calm-greet">{data.greet}{data.name ? `, ${data.name}` : ''}</h1>
      <p className="calm-sum">
        {(nMeet || due || overdue) ? null : <span>{t('noThingsToday')} </span>}
        {parts.map((p, i) => <React.Fragment key={i}>{i ? ' · ' : ''}{p}</React.Fragment>)}
      </p>
      <div className="calm-brief"><Button size="sm" icon="sparkle" onClick={data.openDayBrief}>{t('startMyDay')}</Button></div>

      {(nextEv || task) && (
        <section className="nextup" aria-label={t('nextUp')}>
          <div className="nu-l"><i aria-hidden="true" />
            {nextEv ? `${t('nextUp')} · ${t('inTime')} ${countdown(nextEv.at, now, lang)}`
              : (isOverdue(task.dueDate) ? t('overdue') : t('highPriority'))}
          </div>
          <div className="nu-t">{nextEv ? nextEv.title : task.title}</div>
          {(nextEv || task.dueDate) && (
            <div className="nu-m"><Icon name="clock" size={16} />
              <span>{nextEv ? [nextEv.time, nextEv.sub].filter(Boolean).join(' · ') : relativeDay(task.dueDate, lang)}</span>
            </div>
          )}
          <div className="nu-a">
            <Button variant="brand" onClick={() => (nextEv ? go(nextEv.go) : openTask(task))}>{t('openItem')}</Button>
            <Button icon="whatsapp" onClick={shareAgenda}>{t('shareAgenda')}</Button>
          </div>
        </section>
      )}

      <Section title={t('yourDay')} />
      <ol className="dl">
        {events.map((e, i) => (
          <React.Fragment key={e.key}>
            {i === nowAt && <NowRow now={now} lang={lang} t={t} />}
            <li className={`dl-i k-${e.kind}${isPast(e) ? ' past' : ''}`}>
              <span className="dl-time">{e.time}</span>
              <span className="dl-rail" aria-hidden="true"><span className="dl-dot" /></span>
              <button className="dl-body" onClick={() => go(e.go)}>
                <span className="dl-title">{e.title}</span>
                <span className="dl-sub">
                  <Icon name={KIND_ICON[e.kind]} size={15} />
                  <span>
                    {kindLabel[e.kind]}{e.sub ? ` · ${e.sub}` : ''}
                    {nextPrayer && e.key === nextPrayer.key && <b className="soon"> · {t('inTime')} {countdown(e.at, now, lang)}</b>}
                  </span>
                </span>
              </button>
            </li>
          </React.Fragment>
        ))}
        {nowAt === -1 && <NowRow now={now} lang={lang} t={t} />}
      </ol>

      <Section title={t('needsYou')} count={notifFeed.length || undefined}
        action={notifFeed.length > 3 ? t('viewAll') : undefined} onAction={() => go('notifications')} />
      {notifFeed.length ? (
        <div>
          {notifFeed.slice(0, 3).map(n => (
            <Pressable className="li" key={n.id} onClick={() => go(n.go)}>
              <div className={`lead ${n.tint}`}><Icon name={n.icon} size={18} /></div>
              <div className="body">
                <div className="title">{n.title}</div>
                <div className="meta">{n.meta}</div>
              </div>
              <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
            </Pressable>
          ))}
        </div>
      ) : (
        <p className="calm-clear"><Icon name="check" size={18} /> {t('allCaughtUp')}</p>
      )}

      <Section title={t('moneyThisMonth')} />
      <Pressable className="card money-glance" onClick={() => go('expenses')}>
        <div className="mg-top">
          <span className="mg-amt tnum">{m(data.spentMonth)}</span>
          {budget > 0 && <span className="mg-of">{t('spentOf')} {m(budget)}</span>}
        </div>
        {budget > 0 && (
          <>
            <div className={`mg-bar${left < 0 ? ' over' : ''}`}><span style={{ width: `${pct}%` }} /></div>
            <div className="mg-row">
              <span className={left < 0 ? 't-danger' : ''}>{left >= 0 ? `${m(left)} ${t('leftLbl')}` : `${t('overBudget')} · ${m(-left)}`}</span>
            </div>
          </>
        )}
        <div className="mg-sep" />
        <div className="mg-row"><span>{t('todaysSpending')}</span><b className="tnum">{m(data.spentToday)}</b></div>
      </Pressable>
    </div>
  )
}

function NowRow({ now, lang, t }) {
  return (
    <li className="dl-i now" aria-label={`${t('nowLbl')} ${fmtTime(now, lang)}`}>
      <span className="dl-time">{fmtTime(now, lang)}</span>
      <span className="dl-rail" aria-hidden="true"><span className="dl-dot" /></span>
      <span className="dl-now">{t('nowLbl')}</span>
    </li>
  )
}
