import React, { useState, useEffect, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { prayerTimes, nextPrayer, fmtPrayer, countdown } from '../../lib/prayer.js'

export default function PrayerCard() {
  const { t, lang } = useT()
  const [now, setNow] = useState(() => new Date())

  // tick every 30s so the countdown stays live
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const times = useMemo(() => prayerTimes(now), [now.toDateString()])
  const next = useMemo(() => nextPrayer(now), [Math.floor(now.getTime() / 60000)])

  return (
    <div className="card tight" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="lead t-ok" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center' }}>
          <Icon name="sun" size={18} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('prayerTimes')} · Riyadh</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {t('nextPrayer')}: {t(next.name)} · {fmtPrayer(next.date, lang)} <span className="muted" style={{ fontWeight: 600 }}>({t('inLabel')} {countdown(next.date, now, lang)})</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
        {times.map(p => {
          const isNext = p.name === next.name && p.date.toDateString() === next.date.toDateString()
          return (
            <div key={p.name} style={{
              textAlign: 'center', padding: '8px 2px', borderRadius: 12,
              background: isNext ? 'var(--ok-tint)' : 'transparent',
              color: isNext ? 'var(--ok)' : 'var(--ink-2)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 650 }}>{t(p.name)}</div>
              <div className="tnum" style={{ fontSize: 12, marginTop: 2 }}>{fmtPrayer(p.date, lang)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
