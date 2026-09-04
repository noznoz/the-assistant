import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { classifyCapture } from '../../lib/parseCapture.js'

// One box that turns a plain sentence into the right record. It shows a live
// preview of what it will create; tapping the preview (or Enter / the + button)
// files it. Fully on-device — no network, no AI key required.
const COLLECTION = { expense: 'expenses', appointment: 'appointments', reminder: 'reminders', task: 'tasks' }
const ICON = { expense: 'wallet', appointment: 'calendar', reminder: 'bell', task: 'check' }

export default function QuickCapture({ toast }) {
  const { t } = useT()
  const { settings } = useSettings()
  const [text, setText] = useState('')
  const cols = {
    expenses: useCollection('expenses'),
    appointments: useCollection('appointments'),
    reminders: useCollection('reminders'),
    tasks: useCollection('tasks'),
  }
  const plan = text.trim() ? classifyCapture(text, { currency: settings.currency }) : null

  const submit = () => {
    if (!plan) return
    cols[COLLECTION[plan.type]].add(plan.fields)
    toast.show(`${t('cap_' + plan.type)} ${t('added').toLowerCase()}`)
    setText('')
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
        {plan && (
          <button aria-label={t('add')} onClick={submit}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: 0, background: 'var(--brand-600)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Icon name="plus" size={18} />
          </button>
        )}
      </div>
      {plan && (
        <button onClick={submit}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'start', marginTop: 6, padding: '8px 11px', background: 'var(--brand-tint)', color: 'var(--brand-600)', border: 0, borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600 }}>
          <Icon name={ICON[plan.type]} size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <b>{t('cap_' + plan.type)}</b> · {plan.label}
          </span>
        </button>
      )}
    </div>
  )
}
