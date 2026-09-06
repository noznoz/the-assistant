import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { Button } from '../../ui/primitives.jsx'
import { money } from '../../lib/format.js'
import QuickCapture from './QuickCapture.jsx'

// Alternative Today-screen layouts, chosen from Settings → Customize home.
// Each renders the same real data (built in TodayScreen) in a different shape.
// Classic and Focus live in TodayScreen itself; these are Cover / Timeline / Bento.

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (d) => `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}`
const minsOfDay = (d) => { const x = new Date(d); return x.getHours() * 60 + x.getMinutes() }
const minsFromHHMM = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
function until(date) {
  const ms = new Date(date) - Date.now()
  if (ms <= 0) return ''
  const m = Math.round(ms / 60000), h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

// Build today's chronological events from appointments, reminders and the next
// prayer — the shared spine for Timeline and the "next up" tile in Bento.
function timedEvents(data, t) {
  const evs = []
  data.appts.forEach(a => evs.push({ min: minsFromHHMM(a.time), time: a.time || '—', title: a.title, sub: a.location || '', kind: 'appt' }))
  data.rems.forEach(r => evs.push({ min: minsOfDay(r.remindAt), time: hhmm(r.remindAt), title: r.text, sub: '', kind: 'rem' }))
  if (data.prayer && data.prayer.date) {
    evs.push({ min: minsOfDay(data.prayer.date), time: data.prayer.time, title: data.prayer.name, sub: `${t('nextPrayer')} · ${until(data.prayer.date)}`, kind: 'prayer' })
  }
  return evs.sort((a, b) => a.min - b.min)
}

export default function HomeLayout({ variant, data, go, t, lang, toast }) {
  if (variant === 'cover') return <CoverHome data={data} go={go} t={t} lang={lang} toast={toast} />
  if (variant === 'timeline') return <TimelineHome data={data} go={go} t={t} lang={lang} toast={toast} />
  if (variant === 'bento') return <BentoHome data={data} go={go} t={t} lang={lang} toast={toast} />
  return null
}

/* ---- Cover: an editorial daily front page ---- */
function CoverHome({ data, go, t, lang, toast }) {
  const { counts, priorityTask, appts, rems } = data
  const agenda = timedEvents(data, t).filter(e => e.kind !== 'prayer').slice(0, 4)
  const headline = priorityTask
    ? <>{t('coverOneThing')} <b>{priorityTask.title}</b>.</>
    : (appts.length || rems.length)
      ? <>{appts.length + rems.length} {t('coverAgendaItems')}</>
      : t('coverClear')
  return (
    <div className="cover">
      <div className="cover-kicker">{data.greet}{data.name ? ` · ${data.name}` : ''}</div>
      <div className="cover-date">
        <span className="cd-day">{data.day}</span>
        <div><div className="cd-mo">{data.mon} {data.year}</div><div className="cd-hj">{data.hijri}</div></div>
      </div>
      <QuickCapture toast={toast} go={go} />
      <div className="cover-rule" />
      <h2 className="cover-headline">{headline}</h2>
      <div className="cover-stat">
        {counts.due > 0 && <span><b>{counts.due}</b> {t('due')}</span>}
        {counts.overdue > 0 && <span><b>{counts.overdue}</b> {t('overdue')}</span>}
        {data.prayer && <span className="cover-pray">🕌 {data.prayer.name} {data.prayer.time}</span>}
      </div>
      <div className="cover-agenda">
        {agenda.length > 0 && <div className="cover-lbl">{t('laterToday')}</div>}
        {agenda.map((e, i) => (
          <div className="cover-arow" key={i} onClick={() => go(e.kind === 'rem' ? 'reminders' : 'calendar')}>
            <span className="tm">{e.kind === 'rem' ? <Icon name="bell" size={14} /> : e.time}</span>
            <span className="ti">{e.title}</span>
          </div>
        ))}
        <div className="cover-actions">
          <Button variant="brand" icon="sparkle" onClick={data.openDayBrief}>{t('startMyDay')}</Button>
        </div>
      </div>
    </div>
  )
}

/* ---- Timeline: the day as a single spine from now forward ---- */
function TimelineHome({ data, go, t, lang, toast }) {
  const events = timedEvents(data, t)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const { counts } = data
  return (
    <div className="tl">
      <div className="tl-now"><span className="tl-dot" /> {t('now')} {hhmm(new Date())} · {data.weekday} {data.day} {data.mon} · {data.hijri}</div>
      <QuickCapture toast={toast} go={go} />
      <div className="tl-rail">
        {events.length === 0 && <div className="tl-empty">{t('dayOpen')}</div>}
        {events.map((e, i) => (
          <div className={`tl-ev ${e.kind === 'prayer' ? 'on' : ''} ${e.min < nowMin ? 'past' : ''}`} key={i}
            onClick={() => go(e.kind === 'rem' ? 'reminders' : e.kind === 'prayer' ? 'spiritual' : 'calendar')}>
            <div className="tm">{e.time}</div>
            <div className="ti">{e.kind === 'prayer' ? '🕌 ' : ''}{e.title}</div>
            {e.sub && <div className="sb">{e.sub}</div>}
          </div>
        ))}
        {(counts.due + counts.overdue + counts.waiting) > 0 && (
          <div className="tl-ev tasks" onClick={() => go('tasks')}>
            <div className="tm">{t('tasksLabel')}</div>
            <div className="tl-card">
              <div className="tl-card-t">{counts.due} {t('dueToday')}</div>
              <div className="tl-card-s">
                {counts.overdue > 0 && <span style={{ color: 'var(--danger)' }}>{counts.overdue} {t('overdue')}</span>}
                {counts.overdue > 0 && counts.waiting > 0 && ' · '}
                {counts.waiting > 0 && <span>{counts.waiting} {t('waitingForMe')}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="tl-foot">
        <Button variant="brand" block icon="sparkle" onClick={data.openDayBrief}>{t('startMyDay')}</Button>
      </div>
    </div>
  )
}

/* ---- Bento: a glanceable grid of tiles ---- */
function BentoHome({ data, go, t, lang, toast }) {
  const { counts, cur } = data
  const next = timedEvents(data, t).find(e => e.min >= new Date().getHours() * 60 + new Date().getMinutes()) || timedEvents(data, t)[0]
  const budget = Number(data.budget) || 0
  return (
    <div className="bento-wrap">
      <div className="bento-hd">
        <div><div className="bg">{data.greet}</div><div className="bnm">{data.name || t('today')}</div></div>
        <div className="bento-date"><div className="bd">{data.day} {data.mon}</div><div className="bh">{data.hijri}</div></div>
      </div>
      <QuickCapture toast={toast} go={go} />
      <div className="bento">
        {next && (
          <div className="bt next wide" onClick={() => go(next.kind === 'rem' ? 'reminders' : next.kind === 'prayer' ? 'spiritual' : 'calendar')}>
            <div className="lbl">{t('nextUp')} · {next.time}</div>
            <div><div className="big">{next.kind === 'prayer' ? '🕌 ' : ''}{next.title}</div>{next.sub && <div className="sm">{next.sub}</div>}</div>
          </div>
        )}
        <div className="bt" onClick={() => go('notifications')}>
          <div className="lbl">{t('needsYou')}</div><div className="num">{counts.needsYou}</div>
          <div className="sm">{counts.overdue} {t('overdue')}{counts.waiting ? ` · ${counts.waiting} ${t('waitingShort')}` : ''}</div>
        </div>
        {data.prayer && (
          <div className="bt" onClick={() => go('spiritual')}>
            <div className="lbl">🕌 {t('nextPrayer')}</div>
            <div><div className="big">{data.prayer.name}</div><div className="sm tnum">{data.prayer.time} · {until(data.prayer.date)}</div></div>
          </div>
        )}
        <div className="bt" onClick={() => go('expenses')}>
          <div className="lbl">{t('spentToday')}</div>
          <div className="big tnum">{money(data.spentToday, cur, lang)}</div>
          {budget > 0 && <div className="sm">{t('ofLabel')} {money(budget, cur, lang)}</div>}
        </div>
        <div className="bt" onClick={() => go('reminders')}>
          <div className="lbl">{t('reminders')}</div><div className="num">{data.remindersCount}</div>
          <div className="sm">{data.rems[0] ? data.rems[0].text : t('allCaughtUp')}</div>
        </div>
        <div className="bt brand wide" onClick={data.openDayBrief}>
          <Icon name="sparkle" size={18} /> {t('startMyDay')}
        </div>
      </div>
    </div>
  )
}
