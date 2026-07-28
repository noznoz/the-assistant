import React, { useRef, useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Select, Segmented, Button, useToast } from '../../ui/primitives.jsx'
import PinPad from '../../ui/PinPad.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings, useStore } from '../../store/StoreProvider.jsx'
import { LANGS } from '../../i18n/strings.js'
import { CURRENCIES } from '../../lib/domain.js'
import * as db from '../../store/db.js'
import { hashPin, biometricSupported, enrollBiometric } from '../../lib/lock.js'
import { requestNotificationPermission, notificationPermission, setBadge } from '../../lib/notify.js'

export default function SettingsScreen({ go }) {
  const { t } = useT()
  const { settings, updateSettings } = useSettings()
  const { reloadAll } = useStore()
  const toast = useToast()
  const fileRef = useRef()
  const [setup, setSetup] = useState(false)   // passcode setup overlay

  const doExport = () => {
    const blob = new Blob([JSON.stringify(db.exportAll(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `the-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url)
    toast.show(t('savedToast'))
  }

  const doImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try { db.importAll(JSON.parse(reader.result)); reloadAll(); toast.show(t('savedToast')) }
      catch { toast.show('Invalid file') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const doWipe = () => {
    if (!window.confirm(t('deleteAll') + '?')) return
    db.wipeAll(); reloadAll(); toast.show(t('deletedToast')); go('today')
  }

  const set = (k) => (e) => updateSettings({ [k]: e.target.value })

  const savePasscode = async (pin) => {
    const pinHash = await hashPin(pin)
    updateSettings({ pinHash, requireLock: true })
    setSetup(false); toast.show(t('savedToast'))
  }
  const turnOffLock = () => updateSettings({ requireLock: false, pinHash: '', biometricId: '' })

  const toggleFaceId = async () => {
    if (settings.biometricId) { updateSettings({ biometricId: '' }); return }
    try { const id = await enrollBiometric(settings.name || 'The Assistant'); updateSettings({ biometricId: id }); toast.show(t('savedToast')) }
    catch { toast.show(t('comingSoon')) }
  }

  const toggleNotifications = async (v) => {
    if (v) {
      const perm = await requestNotificationPermission()
      if (perm === 'granted') { updateSettings({ notifications: true }); toast.show(t('savedToast')) }
      else { toast.show(t('notifDenied')) }
    } else { updateSettings({ notifications: false }); setBadge(0) }
  }

  const lockOn = settings.requireLock && !!settings.pinHash

  return (
    <>
      <DetailHeader title={t('settings')} onBack={() => go('more')} />
      <div className="screen">
        <Section title={t('profile')} />
        <Card className="stack">
          <Field label={t('name')}><Input value={settings.name} onChange={set('name')} placeholder="Nizar" /></Field>
        </Card>

        <Section title={t('appearance')} />
        <Card className="stack">
          <Field label={t('language')}>
            <Select value={settings.language} onChange={set('language')}
              options={Object.entries(LANGS).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label={t('appearance')}>
            <Segmented value={settings.theme} onChange={(v) => updateSettings({ theme: v })} options={[
              { value: 'system', label: t('themeSystem') },
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
            ]} />
          </Field>
        </Card>

        <Section title={t('currency')} />
        <Card className="stack">
          <div className="row2">
            <Field label={t('currency')}>
              <Select value={settings.currency} onChange={set('currency')} options={CURRENCIES.map(c => ({ value: c, label: c }))} />
            </Field>
            <Field label={t('dateFormat')}>
              <Select value={settings.dateFormat} onChange={set('dateFormat')} options={[
                { value: 'DD MMM YYYY', label: '25 Jul 2026' },
                { value: 'DD/MM/YYYY', label: '25/07/2026' },
                { value: 'MM/DD/YYYY', label: '07/25/2026' },
                { value: 'YYYY-MM-DD', label: '2026-07-25' },
              ]} />
            </Field>
          </div>
          <Field label={t('monthlyBudget')} hint={settings.currency}>
            <Input type="number" value={settings.monthlyBudget} onChange={set('monthlyBudget')} placeholder="0" />
          </Field>
          <Field label={t('timezone')}>
            <Input value={settings.timezone} onChange={set('timezone')} />
          </Field>
        </Card>

        {/* Notifications */}
        <Section title={t('notifications')} />
        <Card className="stack">
          <Row icon="bell" label={t('notificationsLabel')} value={settings.notifications ? t('notifOn') : t('notifOff')}
            on={settings.notifications} onToggle={toggleNotifications} />
          <p className="hint" style={{ margin: '0 2px' }}>{t('notifHint')}</p>
          {notificationPermission() === 'denied' && <p className="err" style={{ margin: '0 2px' }}>{t('notifDenied')}</p>}
        </Card>

        {/* App lock */}
        <Section title={t('appLock')} />
        <Card className="stack">
          {!lockOn ? (
            <>
              <Button block icon="lock" onClick={() => setSetup(true)}>{t('setPasscode')}</Button>
              <p className="hint" style={{ margin: '0 2px' }}>{t('lockHint')}</p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="lead t-ok" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="lock" size={18} /></span>
                <span style={{ fontWeight: 650, flex: 1 }}>{t('passcodeOn')}</span>
              </div>
              {biometricSupported() && (
                <Row icon="shield" label={t('useFaceId')} value={settings.biometricId ? t('notifOn') : t('notifOff')}
                  on={!!settings.biometricId} onToggle={toggleFaceId} />
              )}
              <div className="row2">
                <Button icon="lock" onClick={() => setSetup(true)}>{t('changePasscode')}</Button>
                <Button variant="danger" icon="x" onClick={turnOffLock}>{t('turnOffLock')}</Button>
              </div>
            </>
          )}
        </Card>

        <Section title={t('aiProvider')} />
        <Card className="stack">
          <Field label={t('aiProvider')} hint="Used later for the assistant. Offline heuristics work today.">
            <Select value={settings.aiProvider} onChange={set('aiProvider')} options={[
              { value: 'none', label: 'Offline (built-in)' },
              { value: 'claude', label: 'Claude API' },
              { value: 'openai', label: 'OpenAI API' },
            ]} />
          </Field>
        </Card>

        <Section title={t('backup')} />
        <Card className="stack">
          <Button block icon="download" onClick={doExport}>{t('exportData')}</Button>
          <Button block icon="upload" onClick={() => fileRef.current?.click()}>{t('importData')}</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={doImport} />
          <Button block variant="danger" icon="trash" onClick={doWipe}>{t('deleteAll')}</Button>
        </Card>

        <p className="center muted" style={{ marginTop: 24, fontSize: 12 }}>
          {t('about')} · v1.7 · <span>Offline-first</span>
        </p>
      </div>

      {setup && <PasscodeSetup onCancel={() => setSetup(false)} onSet={savePasscode} />}
      {toast.node}
    </>
  )
}

function Row({ icon, label, value, on, onToggle }) {
  return (
    <button onClick={() => onToggle(!on)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 0, color: 'var(--ink)', padding: 0,
    }}>
      <Icon name={icon} size={18} style={{ color: 'var(--ink-3)' }} />
      <span style={{ flex: 1, textAlign: 'start', fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--ink-3)', marginInlineEnd: 6 }}>{value}</span>
      <span style={{ width: 46, height: 28, borderRadius: 14, background: on ? 'var(--ok)' : 'var(--line-2)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
      </span>
    </button>
  )
}

// Two-step passcode setup: create then confirm.
function PasscodeSetup({ onSet, onCancel }) {
  const { t } = useT()
  const [first, setFirst] = useState(null)
  const [error, setError] = useState(0)

  const onComplete = (pin) => {
    if (first == null) { setFirst(pin); return }
    if (pin === first) onSet(pin)
    else { setError(e => e + 1); setFirst(null) }
  }

  return (
    <div className="lock-screen">
      <button className="iconbtn" onClick={onCancel} aria-label={t('cancel')}
        style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', insetInlineEnd: 16 }}>
        <Icon name="x" size={18} />
      </button>
      <div className="lock-brand"><Icon name="lock" size={30} /></div>
      <PinPad
        title={first == null ? t('createPasscode') : t('confirmPasscode')}
        subtitle={first == null ? t('lockHint') : ''}
        onComplete={onComplete}
        error={error ? t('passcodeMismatch') : ''}
      />
    </div>
  )
}
