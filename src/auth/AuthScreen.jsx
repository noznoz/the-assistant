import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import Shell, { field, primaryBtn } from './Shell.jsx'

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, redeemInvite } = useAuth()
  const [mode, setMode] = useState('signin')      // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    if (mode === 'signin') {
      const { error } = await signIn({ email, password })
      if (error) setMsg({ type: 'err', text: error.message })
    } else {
      const { error } = await signUp({ email, password, name })
      if (error) { setMsg({ type: 'err', text: error.message }) }
      else {
        // If a session is active (email confirmation off) and a code was given, redeem it.
        if (invite.trim()) await redeemInvite(invite.trim())
        setMsg({ type: 'ok', text: 'Account created! If asked, confirm your email, then sign in.' })
      }
    }
    setBusy(false)
  }

  async function google() {
    setBusy(true); setMsg(null)
    const { error } = await signInWithGoogle()
    if (error) { setMsg({ type: 'err', text: error.message }); setBusy(false) }
  }

  const tab = (id, label) => (
    <button onClick={() => { setMode(id); setMsg(null) }} style={{
      flex: 1, padding: '9px 0', fontSize: 14, fontWeight: 600,
      color: mode === id ? 'var(--orange)' : 'var(--text-muted)',
      borderBottom: `2px solid ${mode === id ? 'var(--orange)' : 'transparent'}`,
    }}>{label}</button>
  )

  return (
    <Shell>
      <div style={{ display: 'flex', marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        {tab('signin', 'Sign In')}
        {tab('signup', 'Join the Crew')}
      </div>

      <form onSubmit={submit}>
        {mode === 'signup' && (
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your rider name" style={field} required />
        )}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={field} required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={field} required minLength={6} />
        {mode === 'signup' && (
          <input value={invite} onChange={e => setInvite(e.target.value)} placeholder="Invite code (optional)" style={field} />
        )}

        {msg && (
          <p style={{ fontSize: 12, marginBottom: 12, color: msg.type === 'err' ? '#e57373' : '#4caf50', lineHeight: 1.5 }}>
            {msg.text}
          </p>
        )}

        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, marginBottom: 12 }}>
          {busy ? '…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <button onClick={google} disabled={busy} style={{
        width: '100%', background: '#fff', color: '#111', fontWeight: 600, fontSize: 14,
        padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <GoogleG /> Continue with Google
      </button>

      {mode === 'signup' && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 14, textAlign: 'center' }}>
          With a valid invite code you're in instantly. Otherwise an admin approves you first.
        </p>
      )}
    </Shell>
  )
}

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
