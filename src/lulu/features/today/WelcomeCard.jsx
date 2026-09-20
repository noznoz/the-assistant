import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'

// A friendly first-run checklist so a new user's setup is solid from day one.
// Each step shows a ✓ once its setting is in place; it stays until the user
// hides it. Steps that have no clear "done" state are plain shortcuts.
export default function WelcomeCard({ go }) {
  const { t } = useT()
  const { settings, updateSettings } = useSettings()
  if (settings.welcomeDismissed) return null

  const steps = [
    { done: !!settings.name, label: t('welcomeName'), go: 'profile' },
    { done: !!settings.prayerCity, label: t('welcomeCity'), go: 'settings' },
    { done: !!settings.notifications, label: t('welcomeAlerts'), go: 'settings' },
    { done: null, label: t('welcomePersonalize'), go: 'dashboard' },
    { done: null, label: t('welcomeBackup'), go: 'cloud' },
  ]
  const trackable = steps.filter(s => s.done !== null)
  const complete = trackable.filter(s => s.done).length

  return (
    <Card style={{ marginTop: 14, background: 'var(--brand-tint)', borderColor: 'var(--brand-500)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="sparkle" size={18} style={{ color: 'var(--brand-600)' }} />
        <h3 style={{ flex: 1, fontSize: 16 }}>{t('welcomeTitle')}</h3>
        <button className="iconbtn" aria-label={t('hide')} onClick={() => updateSettings({ welcomeDismissed: true })}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
        {t('welcomeSub')} · {complete}/{trackable.length}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => go(s.go)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 4px', background: 'none', border: 0, borderTop: i ? '1px solid var(--line)' : 0, textAlign: 'start', cursor: 'pointer' }}>
            <span className={`check ${s.done ? 'on' : ''}`} style={{ width: 22, height: 22, pointerEvents: 'none' }}>
              {s.done ? <Icon name="check" size={13} stroke={3} /> : null}
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: s.done ? 'var(--ink-3)' : 'var(--ink)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
            <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
          </button>
        ))}
      </div>
      {complete === trackable.length && (
        <button className="btn brand block sm" style={{ marginTop: 12 }} onClick={() => updateSettings({ welcomeDismissed: true })}>
          {t('welcomeDone')}
        </button>
      )}
    </Card>
  )
}
