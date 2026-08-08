import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Field, Input, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import * as cloud from '../../lib/cloud.js'

// Full-screen login / family-join page. Shown as an app gate when someone opens
// an invite link (#/join/<code>) or the /login route. A member creates their
// account (email + password) and joins the admin's household by code; the admin
// signs in normally. The Supabase connection comes from env or (fallback) the
// advanced fields below, so the invite link never has to carry the key.
export default function AuthScreen({ code = '', onDone }) {
  const { t } = useT()
  const joining = !!code
  const [mode, setMode] = useState(joining ? 'create' : 'signin') // 'signin' | 'create'
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [joinCode, setJoinCode] = useState(code)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showConn, setShowConn] = useState(false)
  const [url, setUrl] = useState((cloud.getConfig() || {}).url || '')
  const [anonKey, setAnonKey] = useState('')

  const configured = cloud.isConfigured()

  const submit = async () => {
    setErr('')
    if (!configured && (!url || !anonKey)) { setShowConn(true); setErr(t('authNeedProject')); return }
    if (!configured) cloud.setConfig(url, anonKey)
    setBusy(true)
    try {
      cloud.setConsent(true)
      if (mode === 'create') await cloud.signUp(email, pass, joinCode)
      else await cloud.signIn(email, pass, joinCode)
      setPass('')
      if (typeof window !== 'undefined') window.location.hash = '#/today'
      onDone && onDone()
    } catch (e) {
      setErr(e.message || t('aiError'))
    } finally { setBusy(false) }
  }

  const title = joining ? t('authJoinTitle') : (mode === 'create' ? t('createAccount') : t('welcomeBack'))
  const sub = joining ? t('authJoinSub') : (mode === 'create' ? t('authCreateSub') : t('authSignInSub'))

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><Icon name="sparkle" size={26} /></div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{sub}</p>

        <Card className="stack">
          <Field label={t('email')}>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com" autoCapitalize="off" spellCheck={false} autoComplete="email" />
          </Field>
          <Field label={t('password')}>
            <Input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••" autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          </Field>
          {joining && (
            <Field label={t('cloudCode')}>
              <Input value={joinCode} onChange={e => setJoinCode(e.target.value)}
                placeholder="household code" autoCapitalize="off" spellCheck={false} />
            </Field>
          )}

          {!configured && showConn && (
            <>
              <p className="hint" style={{ margin: '0 2px' }}>{t('authConnHint')}</p>
              <Field label={t('cloudUrl')}><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="off" spellCheck={false} /></Field>
              <Field label={t('cloudAnonKey')}><Input type="password" value={anonKey} onChange={e => setAnonKey(e.target.value)} placeholder="eyJhbGciOi…" autoComplete="off" spellCheck={false} /></Field>
            </>
          )}

          {err && <p className="err" style={{ margin: '0 2px' }}>{err}</p>}

          <Button block variant="primary" icon="check" onClick={submit} disabled={busy || !email || !pass}>
            {busy ? t('thinking') + '…' : (mode === 'create' ? t('createAccount') : t('signIn'))}
          </Button>

          {!joining && !configured && !showConn && (
            <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setShowConn(true)}>{t('authAdvanced')}</button>
          )}
        </Card>

        <button className="auth-toggle" onClick={() => setMode(m => m === 'create' ? 'signin' : 'create')}>
          {mode === 'create' ? t('authToggleSignIn') : t('authToggleCreate')}
        </button>
      </div>
    </div>
  )
}
