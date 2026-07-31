import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { PRAYERS, dayCount, prayerStreak, weekPrayers } from '../../lib/spiritual.js'
import { hijriDate } from '../../lib/prayer.js'
import { todayISO, fmtDate } from '../../lib/format.js'

const PRAYER_LABEL = { fajr: { en: 'Fajr', ar: 'الفجر' }, dhuhr: { en: 'Dhuhr', ar: 'الظهر' }, asr: { en: 'Asr', ar: 'العصر' }, maghrib: { en: 'Maghrib', ar: 'المغرب' }, isha: { en: 'Isha', ar: 'العشاء' } }

// Daily prayer tracking with streaks, plus Quran pages and fasting.
export default function SpiritualScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const spiritual = useCollection('spiritual')
  const today = todayISO()
  const recFor = (d) => spiritual.items.find(x => x.date === d)
  const todayRec = recFor(today)

  const ensure = (d) => {
    let r = recFor(d)
    if (!r) r = spiritual.add({ date: d, prayers: {}, quran: 0, fasted: false })
    return r
  }
  const togglePrayer = (p) => {
    const r = ensure(today)
    const prayers = { ...(r.prayers || {}) }
    prayers[p] = !prayers[p]
    spiritual.save({ ...r, prayers })
  }
  const setQuran = (delta) => {
    const r = ensure(today)
    spiritual.save({ ...r, quran: Math.max(0, (Number(r.quran) || 0) + delta) })
  }
  const toggleFast = () => {
    const r = ensure(today)
    spiritual.save({ ...r, fasted: !r.fasted })
  }

  const streak = prayerStreak(spiritual.items)
  const week = weekPrayers(spiritual.items, 7)
  const doneToday = dayCount(todayRec)

  // Last 14 days grid.
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(new Date(today).getTime() - i * 86400000).toISOString().slice(0, 10)
    days.push({ d, n: dayCount(recFor(d)) })
  }
  const shade = (n) => n === 0 ? 'var(--surface-2)' : n < 3 ? 'var(--brand-200, #e7d8bd)' : n < 5 ? 'var(--brand-400)' : 'var(--ok)'

  return (
    <>
      <DetailHeader title={t('spiritual')} onBack={() => go('more')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('prayerStreak')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }}>🔥 {streak}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{hijriDate(new Date(), lang)}</div>
        </Card>

        <Section title={t('todaysPrayers')} count={`${doneToday}/5`} />
        <Card className="stack">
          {PRAYERS.map(p => {
            const on = !!(todayRec?.prayers || {})[p]
            return (
              <button key={p} onClick={() => togglePrayer(p)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '4px 2px',
                background: 'transparent', border: 0, color: 'var(--ink)',
              }}>
                <span className={`check ${on ? 'on' : ''}`} aria-hidden>{on && <Icon name="check" size={15} stroke={3} />}</span>
                <span style={{ flex: 1, textAlign: 'start', fontWeight: 600, fontSize: 15 }}>{PRAYER_LABEL[p][lang === 'ar' ? 'ar' : 'en']}</span>
                {on && <span className="chip t-ok" style={{ padding: '1px 8px' }}>{t('done')}</span>}
              </button>
            )
          })}
        </Card>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          <Stat label={t('thisWeek')} value={`${week}/35`} />
          <Card tight style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: 14 }}>
            <div>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 650, textTransform: 'uppercase' }}>{t('quranPages')}</div>
              <b className="tnum" style={{ fontSize: 18 }}>{Number(todayRec?.quran) || 0}</b>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn sm" onClick={() => setQuran(-1)}>−</button>
              <button className="btn sm" onClick={() => setQuran(1)}>+</button>
            </div>
          </Card>
        </div>

        <Card tight style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
          <span className={`lead ${todayRec?.fasted ? 't-ok' : ''}`} style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: todayRec?.fasted ? undefined : 'var(--surface-2)' }}><Icon name="sparkle" size={18} /></span>
          <span style={{ flex: 1, fontWeight: 600 }}>{t('fastingToday')}</span>
          <button onClick={toggleFast} aria-label={t('fastingToday')} style={{ width: 46, height: 28, borderRadius: 14, border: 0, background: todayRec?.fasted ? 'var(--ok)' : 'var(--line-2)', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, insetInlineStart: todayRec?.fasted ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
          </button>
        </Card>

        <Section title={t('last14days')} />
        <Card>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'space-between' }}>
            {days.map(({ d, n }) => (
              <div key={d} title={`${fmtDate(d, lang, settings.dateFormat)} · ${n}/5`} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 26, borderRadius: 6, background: shade(n) }} />
                <div className="muted" style={{ fontSize: 9, marginTop: 3 }}>{new Date(d).getDate()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
