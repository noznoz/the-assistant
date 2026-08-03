import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Card, Section } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore, useSettings } from '../../store/StoreProvider.jsx'

// Grouped, colour-coded navigation. Each group has an accent tint so the long
// list scans as a map rather than one flat column.
const GROUPS = [
  {
    key: 'grpWork', tint: 't-brand', items: [
      { id: 'assistant', icon: 'sparkle' },
      { id: 'work', icon: 'report' },
      { id: 'followup', icon: 'bell', label: 'followUps' },
      { id: 'orgchart', icon: 'people', label: 'orgChart' },
      { id: 'workboard', icon: 'grid', label: 'workDashboard' },
      { id: 'meetings', icon: 'note' },
    ],
  },
  {
    key: 'grpPlan', tint: 't-info', items: [
      { id: 'week', icon: 'calendar' },
      { id: 'calendar', icon: 'calendar' },
      { id: 'appointments', icon: 'clock', collection: 'appointments' },
      { id: 'renewals', icon: 'shield' },
      { id: 'emergency', icon: 'shield', label: 'emergencyCard' },
      { id: 'notifications', icon: 'bell' },
      { id: 'inbox', icon: 'inbox', collection: 'inbox' },
      { id: 'notes', icon: 'note', collection: 'notes' },
    ],
  },
  {
    key: 'grpPeople', tint: 't-brand', items: [
      { id: 'people', icon: 'people', collection: 'people' },
      { id: 'keepintouch', icon: 'bell', label: 'keepInTouch' },
      { id: 'occasions', icon: 'cake' },
      { id: 'staff', icon: 'wrench', collection: 'staff', label: 'householdStaff' },
    ],
  },
  {
    key: 'grpHome', tint: 't-ok', items: [
      { id: 'garage', icon: 'car', collection: 'vehicles' },
      { id: 'properties', icon: 'doc', collection: 'properties' },
      { id: 'valuables', icon: 'gift', collection: 'valuables' },
      { id: 'memberships', icon: 'wallet', collection: 'memberships' },
      { id: 'wishlist', icon: 'gift', collection: 'wishlist' },
      { id: 'documents', icon: 'doc', collection: 'documents' },
      { id: 'trips', icon: 'trip', collection: 'trips' },
    ],
  },
  {
    key: 'grpFaith', tint: 't-warn', items: [
      { id: 'spiritual', icon: 'sparkle' },
      { id: 'hijri', icon: 'calendar', label: 'hijriCalendar' },
      { id: 'giving', icon: 'gift' },
    ],
  },
  {
    key: 'grpReports', tint: 't-brand', items: [
      { id: 'boardpack', icon: 'report', label: 'boardPack' },
      { id: 'monthlyreport', icon: 'report', label: 'monthlyReport' },
      { id: 'reports', icon: 'chart' },
      { id: 'settings', icon: 'cog' },
    ],
  },
]

const ALL_ITEMS = GROUPS.flatMap(g => g.items.map(it => ({ ...it, tint: g.tint })))

// Build timestamp injected by Vite at build time (see vite.config define).
const BUILD_STAMP = (() => {
  try {
    const iso = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
    if (!iso) return 'dev'
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch { return 'dev' }
})()

export default function MoreScreen({ go }) {
  const { t } = useT()
  const { data } = useStore()
  const { settings, updateSettings } = useSettings()
  const [q, setQ] = useState('')
  const p = settings.profile || {}
  const favorites = settings.favorites || []

  const initials = (p.fullName || settings.name || '')
    .split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'NB'
  const count = (it) => it.collection ? (data[it.collection] || []).length : 0

  const toggleFav = (id) => {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]
    updateSettings({ favorites: next })
  }

  const lbl = (it) => t(it.label || it.id)
  const s = q.trim().toLowerCase()
  const matches = useMemo(() => s ? ALL_ITEMS.filter(it => lbl(it).toLowerCase().includes(s)) : [], [s])
  const favItems = favorites.map(id => ALL_ITEMS.find(it => it.id === id)).filter(Boolean)

  const Row = ({ it, i, first }) => (
    <div style={{ display: 'flex', alignItems: 'center', borderTop: !first && i ? '1px solid var(--line)' : 0 }}>
      <button onClick={() => go(it.id)} style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 4px 13px 12px',
        background: 'transparent', border: 0, color: 'var(--ink)', minWidth: 0,
      }}>
        <span className={`lead ${it.tint}`} style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={it.icon} size={20} />
        </span>
        <span style={{ flex: 1, textAlign: 'start', fontWeight: 600, fontSize: 15 }}>{lbl(it)}</span>
        {count(it) > 0 && <span className="chip">{count(it)}</span>}
      </button>
      <button onClick={() => toggleFav(it.id)} aria-label={t('pin')} className="iconbtn" style={{ marginInlineEnd: 6, opacity: favorites.includes(it.id) ? 1 : 0.4, color: favorites.includes(it.id) ? 'var(--brand-600)' : 'var(--ink-3)' }}>
        <Icon name="star" size={17} stroke={favorites.includes(it.id) ? 2.6 : 1.8} />
      </button>
    </div>
  )

  return (
    <>
      <TopBar title={t('more')} />
      <div className="screen">
        {/* Profile header */}
        <button onClick={() => go('profile')} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, padding: 16,
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', color: 'var(--ink)',
        }}>
          <span style={{
            width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: 'var(--brand-tint)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center',
          }}>
            {p.photo
              ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontWeight: 780, fontSize: 20 }}>{initials}</span>}
          </span>
          <span style={{ flex: 1, textAlign: 'start', minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 750, fontSize: 16 }}>{p.fullName || settings.name || t('yourName')}</span>
            <span className="muted" style={{ display: 'block', fontSize: 13 }}>{p.jobTitle || t('viewProfile')}</span>
          </span>
          <Icon name="chevron" size={18} style={{ color: 'var(--ink-3)' }} />
        </button>

        {/* Search / filter */}
        <div className="field" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', padding: '0 12px' }}>
            <Icon name="search" size={18} style={{ color: 'var(--ink-3)' }} />
            <input className="input" style={{ border: 0, background: 'transparent', padding: '11px 0' }} value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchSections')} />
            {q && <button className="iconbtn" aria-label={t('cancel')} onClick={() => setQ('')}><Icon name="x" size={16} /></button>}
          </div>
        </div>

        {s ? (
          <Card tight flat style={{ padding: 6, marginTop: 12 }}>
            {matches.length === 0 ? <p className="muted center" style={{ padding: 16 }}>{t('nothingHere')}</p>
              : matches.map((it, i) => <Row key={it.id} it={it} i={i} />)}
          </Card>
        ) : (
          <>
            {favItems.length > 0 && (
              <>
                <Section title={t('favorites')} />
                <Card tight flat style={{ padding: 6 }}>
                  {favItems.map((it, i) => <Row key={it.id} it={it} i={i} />)}
                </Card>
              </>
            )}
            {GROUPS.map(g => (
              <React.Fragment key={g.key}>
                <Section title={t(g.key)} />
                <Card tight flat style={{ padding: 6 }}>
                  {g.items.map((it, i) => <Row key={it.id} it={{ ...it, tint: g.tint }} i={i} first />)}
                </Card>
              </React.Fragment>
            ))}
          </>
        )}
        <p className="center muted" style={{ marginTop: 24, fontSize: 12 }}>The Assistant · v4.9 · {BUILD_STAMP}</p>
      </div>
    </>
  )
}
