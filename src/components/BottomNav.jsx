const TABS = [
  { id: 'feed',       label: 'Feed',       icon: '📰' },
  { id: 'trips',      label: 'Trips',      icon: '🗺️' },
  { id: 'challenges', label: 'Challenges', icon: '🏆' },
  { id: 'gear',       label: 'Gear',       icon: '🧤' },
  { id: 'riders',     label: 'Riders',     icon: '👤' },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav style={{
      display: 'flex',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      minHeight: 'var(--nav-h)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      flexShrink: 0,
    }}>
      {TABS.map(t => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              color: isActive ? 'var(--orange)' : 'var(--text-muted)',
              transition: 'color 0.15s',
              position: 'relative',
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute',
                top: 0, left: '20%', right: '20%', height: 2,
                background: 'var(--orange)',
                borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: 0.5 }}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
