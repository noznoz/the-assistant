import React, { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './Icon.jsx'
import PinPad from './PinPad.jsx'
import { useT } from '../i18n/I18nProvider.jsx'
import { useSettings } from '../store/StoreProvider.jsx'
import { verifyPin, verifyBiometric } from '../lib/lock.js'

// Gates the whole app behind the passcode when the lock is enabled. Locks on
// cold start and whenever the app returns to the foreground after being hidden.
export default function LockGate({ children }) {
  const { t } = useT()
  const { settings } = useSettings()
  const enabled = settings.requireLock && !!settings.pinHash
  const [locked, setLocked] = useState(enabled)
  const [error, setError] = useState(0)
  const triedBio = useRef(false)

  // If the user turns the lock on/off in Settings, reflect it.
  useEffect(() => { if (!enabled) setLocked(false) }, [enabled])

  // Re-lock when returning from the background.
  useEffect(() => {
    if (!enabled) return
    const onHide = () => { if (document.visibilityState === 'hidden') { setLocked(true); triedBio.current = false } }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [enabled])

  const tryBiometric = useCallback(async () => {
    if (!settings.biometricId) return
    triedBio.current = true
    try { await verifyBiometric(settings.biometricId); setLocked(false) } catch { /* fall back to passcode */ }
  }, [settings.biometricId])

  // Auto-prompt Face ID once when the lock appears.
  useEffect(() => {
    if (locked && enabled && settings.biometricId && !triedBio.current) tryBiometric()
  }, [locked, enabled, settings.biometricId, tryBiometric])

  const onComplete = async (pin) => {
    if (await verifyPin(pin, settings.pinHash)) setLocked(false)
    else setError(e => e + 1)
  }

  if (!enabled || !locked) return children

  return (
    <div className="lock-screen">
      <div className="lock-brand"><Icon name="lock" size={30} /></div>
      <PinPad
        title={t('lockedTitle')}
        subtitle={t('enterPasscode')}
        onComplete={onComplete}
        error={error ? t('wrongPasscode') : ''}
        onFaceId={settings.biometricId ? tryBiometric : undefined}
        faceIdLabel={t('unlockWithFaceId')}
      />
    </div>
  )
}
