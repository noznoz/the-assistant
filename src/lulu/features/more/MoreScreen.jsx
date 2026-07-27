import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { TopBar } from '../../ui/AppShell.jsx'
import { Card } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'

const ITEMS = [
  { id: 'inbox', icon: 'inbox', collection: 'inbox' },
  { id: 'notes', icon: 'note', collection: 'notes' },
  { id: 'calendar', icon: 'calendar' },
  { id: 'people', icon: 'people', collection: 'people' },
  { id: 'documents', icon: 'doc', collection: 'documents' },
  { id: 'trips', icon: 'trip', collection: 'trips' },
  { id: 'reports', icon: 'report' },
  { id: 'notifications', icon: 'bell' },
  { id: 'settings', icon: 'cog' },
]

export default function MoreScreen({ go }) {
  const { t } = useT()
  const store = {
    inbox: useCollection('inbox').items.length,
    notes: useCollection('notes').items.length,
    people: useCollection('people').items.length,
    documents: useCollection('documents').items.length,
    trips: useCollection('trips').items.length,
  }
  return (
    <>
      <TopBar title={t('more')} />
      <div className="screen">
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
        <p className="center muted" style={{ marginTop: 24, fontSize: 12 }}>The Assistant · v1.6</p>
      </div>
    </>
  )
}
