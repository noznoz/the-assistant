import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { classifyCapture, aiClassifyCapture } from '../../lib/parseCapture.js'

// One box that turns a plain sentence into the right record. It shows a live
// (rule-based, instant) preview; on submit, if the user's Claude key is set it
// refines with AI and falls back to the rules on any failure. The "Added" toast
// offers Undo and Edit.
const COLLECTION = { expense: 'expenses', appointment: 'appointments', reminder: 'reminders', task: 'tasks' }
const SCREEN = { expense: 'expenses', appointment: 'appointments', reminder: 'reminders', task: 'tasks' }
const ICON = { expense: 'wallet', appointment: 'calendar', reminder: 'bell', task: 'check' }

export default function QuickCapture({ toast, go }) {
  const { t } = useT()
  const { settings } = useSettings()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const cols = {
    expenses: useCollection('expenses'),
    appointments: useCollection('appointments'),
    reminders: useCollection('reminders'),
    tasks: useCollection('tasks'),
  }
  const preview = text.trim() ? classifyCapture(text, { currency: settings.currency }) : null
  const aiOn = settings.aiProvider === 'claude' && !!settings.anthropicKey

  const submit = async () => {
    const raw = text.trim()
    if (!raw || busy) return
    let plan = classifyCapture(raw, { currency: settings.currency })
    if (!plan) return
    if (aiOn) {
      setBusy(true)
      try {
        const ai = await aiClassifyCapture(raw, { apiKey: settings.anthropicKey, model: settings.aiModel, currency: settings.currency })
        if (ai) plan = ai
      } finally { setBusy(false) }
    }
    const col = cols[COLLECTION[plan.type]]
    const rec = col.add(plan.fields)
    setText('')
    toast.show(`${t('cap_' + plan.type)} ${t('added').toLowerCase()}`, [
      { label: t('undo'), onClick: () => rec && rec.id && col.remove(rec.id) },
      { label: t('edit'), onClick: () => go && go(SCREEN[plan.type]) },
    ])
  }

  return (
    <div style={{ margin: '4px 0 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', padding: '0 6px 0 12px' }}>
        <Icon name="sparkle" size={16} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder={t('addAnything')}
          aria-label={t('addAnything')}
          style={{ flex: 1, border: 0, background: 'transparent', padding: '12px 0', fontSize: 15, color: 'var(--ink-1)', outline: 'none', minWidth: 0 }}
        />
        {preview && (
          <button aria-label={t('add')} onClick={submit} disabled={busy}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: 0, background: 'var(--brand-600)', color: '#fff', display: 'grid', placeItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Icon name={busy ? 'sparkle' : 'plus'} size={18} />
          </button>
        )}
      </div>
      {preview && (
        <button onClick={submit} disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'start', marginTop: 6, padding: '8px 11px', background: 'var(--brand-tint)', color: 'var(--brand-600)', border: 0, borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600 }}>
          <Icon name={ICON[preview.type]} size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <b>{t('cap_' + preview.type)}</b> · {preview.label}
          </span>
          {aiOn && <span style={{ fontSize: 11, opacity: 0.75 }}>{busy ? t('thinking') : '✦ AI'}</span>}
        </button>
      )}
    </div>
  )
}
