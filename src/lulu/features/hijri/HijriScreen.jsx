import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { hijriDate } from '../../lib/prayer.js'
import { upcomingOccasions } from '../../lib/hijri.js'
import { fmtDate, relativeDay } from '../../lib/format.js'
import { label } from '../../lib/domain.js'

// Hijri date + upcoming Islamic occasions with Gregorian dates and countdowns.
export default function HijriScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const occasions = useMemo(() => upcomingOccasions(new Date(), 800), [])

  return (
    <>
      <DetailHeader title={t('hijriCalendar')} onBack={() => go('more')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('todayHijri')}</div>
          <div style={{ fontSize: 26, fontWeight: 780, marginTop: 6 }}>{hijriDate(new Date(), lang)}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{fmtDate(new Date(), lang, settings.dateFormat)}</div>
        </Card>

        <Section title={t('islamicOccasions')} />
        <Card tight>
          {occasions.map(o => (
            <div className="li" key={o.key} onClick={() => o.key === 'ramadan' || o.key === 'eidFitr' ? go('zakat') : null}>
              <div className={`lead ${o.days <= 30 ? 't-brand' : ''}`} style={{ background: o.days <= 30 ? undefined : 'var(--surface-2)' }}><Icon name={o.icon} size={18} /></div>
              <div className="body">
                <div className="title">{label(o, lang)}</div>
                <div className="meta">{fmtDate(o.date, lang, settings.dateFormat)} · {o.hyear} {t('ah')}</div>
              </div>
              <span className={`chip ${o.days <= 30 ? 't-brand' : 't-info'}`}>{o.days === 0 ? t('today') : `${o.days}${lang === 'ar' ? '' : 'd'}`}</span>
            </div>
          ))}
        </Card>
        <p className="hint center" style={{ marginTop: 10 }}>{t('hijriHint')}</p>
      </div>
    </>
  )
}
