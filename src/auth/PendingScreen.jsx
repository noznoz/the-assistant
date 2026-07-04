import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import Shell, { field, primaryBtn } from './Shell.jsx'

export default function PendingScreen() {
  const { profile, signOut, redeemInvite, refreshProfile } = useAuth()
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function redeem() {
    if (!invite.trim()) return
    setBusy(true); setMsg(null)
    const { ok } = await redeemInvite(invite.trim())
    if (!ok) setMsg('That code isn\'t valid. Ask an admin to approve you instead.')
    setBusy(false)
  }

  // Profile fetch failed (offline / bad connection) — this is a connection
  // problem, not an approval problem. Offer a retry instead of a false "pending".
  if (!profile) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📡</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Can't reach the crew</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            We couldn't load your account — check your connection and try again.
          </p>
        </div>
        <button onClick={refreshProfile} style={primaryBtn}>Retry</button>
        <button onClick={signOut} style={{
          width: '100%', fontSize: 13, color: 'var(--text-muted)', padding: 10, marginTop: 10,
        }}>Sign out</button>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Waiting for approval</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Hey {profile.name}, your request to join is in. A crew admin will approve you shortly —
          this screen updates automatically the moment they do.
        </p>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>
        HAVE AN INVITE CODE?
      </p>
      <input value={invite} onChange={e => setInvite(e.target.value)} placeholder="Enter code to skip the line" style={field} />
      {msg && <p style={{ fontSize: 12, color: '#e57373', marginBottom: 12 }}>{msg}</p>}
      <button onClick={redeem} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, marginBottom: 10 }}>
        {busy ? '…' : 'Redeem Code'}
      </button>
      <button onClick={signOut} style={{
        width: '100%', fontSize: 13, color: 'var(--text-muted)', padding: 10,
      }}>Sign out</button>
    </Shell>
  )
}
