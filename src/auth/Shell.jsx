// Shared centered card shell for the auth/setup/pending screens.
export default function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8,
      background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/icon-192.png" alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
          <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: 1, color: 'var(--orange)' }}>ROAD HEAVEN</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Plan. Ride. Connect. Remember.
        </span>
      </div>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 22,
      }}>
        {children}
      </div>
    </div>
  )
}

export const field = {
  width: '100%', background: '#111', border: '1px solid var(--border)',
  borderRadius: 10, padding: '11px 14px', color: 'var(--text)',
  fontSize: 14, outline: 'none', marginBottom: 12,
}

export const primaryBtn = {
  width: '100%', background: 'var(--orange)', color: '#fff',
  fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10,
}
