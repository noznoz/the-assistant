import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Card } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'

const ITEMS = [
  { id: 'week', icon: 'calendar', route: 'week' },
  { id: 'renewals', icon: 'shield' },
  { id: 'emergency', icon: 'shield' },
  { id: 'monthlyreport', icon: 'report' },
  { id: 'inbox', icon: 'inbox', collection: 'inbox' },
  { id: 'notes', icon: 'note', collection: 'notes' },
  { id: 'calendar', icon: 'calendar' },
  { id: 'people', icon: 'people', collection: 'people' },
  { id: 'staff', icon: 'people', collection: 'staff' },
  { id: 'appointments', icon: 'calendar', collection: 'appointments' },
  { id: 'occasions', icon: 'cake' },
  { id: 'hijri', icon: 'calendar' },
  { id: 'properties', icon: 'doc', collection: 'properties' },
  { id: 'wishlist', icon: 'gift', collection: 'wishlist' },
  { id: 'valuables', icon: 'gift', collection: 'valuables' },
  { id: 'memberships', icon: 'gift', collection: 'memberships' },
  { id: 'documents', icon: 'doc', collection: 'documents' },
  { id: 'trips', icon: 'trip', collection: 'trips' },
  { id: 'reports', icon: 'report' },
  { id: 'notifications', icon: 'bell' },
  { id: 'settings', icon: 'cog' },
]

export default function MoreScreen({ go }) {
  const { t } = useT()
  const { settings } = useSettings()
  const p = settings.profile || {}
  const initials = (p.fullName || settings.name || '')
    .split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'NB'
  const store = {
    inbox: useCollection('inbox').items.length,
    notes: useCollection('notes').items.length,
    people: useCollection('people').items.length,
    staff: useCollection('staff').items.length,
    appointments: useCollection('appointments').items.length,
    wishlist: useCollection('wishlist').items.filter(x => !x.purchased).length,
    properties: useCollection('properties').items.length,
    valuables: useCollection('valuables').items.length,
    memberships: useCollection('memberships').items.length,
    documents: useCollection('documents').items.length,
    trips: useCollection('trips').items.length,
  }
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

        <Card tight flat style={{ padding: 6, marginTop: 14 }}>
          {ITEMS.map((it, i) => (
            <button key={it.id} onClick={() => go(it.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 12px',
              background: 'transparent', border: 0, borderTop: i ? '1px solid var(--line)' : 0, color: 'var(--ink)',
            }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--brand-tint)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center' }}>
                <Icon name={it.icon} size={20} />
              </span>
              <span style={{ flex: 1, textAlign: 'start', fontWeight: 600, fontSize: 15 }}>{t(it.id)}</span>
              {it.collection && store[it.collection] > 0 && <span className="chip">{store[it.collection]}</span>}
              <Icon name="chevron" size={18} style={{ color: 'var(--ink-3)' }} />
            </button>
          ))}
        </Card>
        <p className="center muted" style={{ marginTop: 24, fontSize: 12 }}>The Assistant · v3.8</p>
      </div>
    </>
  )
}
