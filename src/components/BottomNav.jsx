const TABS = [
  { id: 'feed',       label: 'Feed',      icon: '📰' },
  { id: 'trips',      label: 'Trips',     icon: '🗺️' },
  { id: 'challenges', label: 'Goals',     icon: '🏆' },
  { id: 'gear',       label: 'Gear',      icon: '🧤' },
  { id: 'riders',     label: 'Riders',    icon: '👤' },
  { id: 'inbox',      label: 'Inbox',     icon: '✉️' },
]

export default function BottomNav({ active, onChange, unreadMessages = 0 }) {
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
        const badge = t.id === 'inbox' && unreadMessages > 0 ? unreadMessages : 0
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
              gap: 2,
              color: isActive ? 'var(--orange)' : 'var(--text-muted)',
              transition: 'color 0.15s',
              position: 'relative',
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute',
                top: 0, left: '15%', right: '15%', height: 2,
                background: 'var(--orange)',
                borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{ fontSize: 18, position: 'relative' }}>
              {t.icon}
              {badge > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: 'var(--orange)', color: '#fff',
                  fontSize: 8, fontWeight: 700, borderRadius: '50%',
                  minWidth: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 2px',
                }}>{badge > 9 ? '9+' : badge}</span>
              )}
            </span>
            <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, letterSpacing: 0.3 }}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
