import React, { useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Select, Segmented, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings, useStore } from '../../store/StoreProvider.jsx'
import { LANGS } from '../../i18n/strings.js'
import { CURRENCIES } from '../../lib/domain.js'
import * as db from '../../store/db.js'

export default function SettingsScreen({ go }) {
  const { t } = useT()
  const { settings, updateSettings } = useSettings()
  const { reloadAll } = useStore()
  const toast = useToast()
  const fileRef = useRef()

  const doExport = () => {
    const blob = new Blob([JSON.stringify(db.exportAll(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `lulu-backup-${new Date().toISOString().slice(0, 10)}.json`
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

        <Section title={t('security')} />
        <Card>
          <Toggle label={t('faceId')} on={settings.requireLock} onChange={(v) => updateSettings({ requireLock: v })} />
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
          {t('about')} · v1.2 · <span>Offline-first</span>
        </p>
      </div>
      {toast.node}
    </>
  )
}

function Toggle({ label, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 0, color: 'var(--ink)', padding: 0,
    }}>
      <Icon name="lock" size={18} style={{ color: 'var(--ink-3)' }} />
      <span style={{ flex: 1, textAlign: 'start', fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ width: 46, height: 28, borderRadius: 14, background: on ? 'var(--ok)' : 'var(--line-2)', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
      </span>
    </button>
  )
}
