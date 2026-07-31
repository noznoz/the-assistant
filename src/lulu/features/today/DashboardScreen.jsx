import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { normalizeDashboard, labelForSection } from '../../lib/dashboard.js'

// Show / hide and reorder the cards on the Today (home) screen.
export default function DashboardScreen({ go }) {
  const { t } = useT()
  const { settings, updateSettings } = useSettings()
  const toast = useToast()
  const list = normalizeDashboard(settings.dashboard)

  const commit = (next) => updateSettings({ dashboard: next })
  const toggle = (key) => commit(list.map(s => s.key === key ? { ...s, on: !s.on } : s))
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = list.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  const reset = () => { commit(normalizeDashboard([])); toast.show(t('savedToast')) }

  return (
    <>
      <DetailHeader title={t('customizeHome')} onBack={() => go('today')} />
      <div className="screen">
        <p className="hint" style={{ margin: '14px 2px 10px' }}>{t('customizeHint')}</p>
        <Card tight flat style={{ padding: 6 }}>
          {list.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderTop: i ? '1px solid var(--line)' : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button className="iconbtn sm" aria-label={t('moveUp')} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1, width: 26, height: 22 }} onClick={() => move(i, -1)}><Icon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button className="iconbtn sm" aria-label={t('moveDown')} disabled={i === list.length - 1} style={{ opacity: i === list.length - 1 ? 0.3 : 1, width: 26, height: 22 }} onClick={() => move(i, 1)}><Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
              </div>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 15, opacity: s.on ? 1 : 0.5 }}>{t(labelForSection(s.key))}</span>
              <button onClick={() => toggle(s.key)} aria-label={t(labelForSection(s.key))}
                style={{ width: 46, height: 28, borderRadius: 14, border: 0, background: s.on ? 'var(--ok)' : 'var(--line-2)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, insetInlineStart: s.on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
              </button>
            </div>
          ))}
        </Card>
        <div style={{ marginTop: 16 }}>
          <Button block icon="refresh" onClick={reset}>{t('resetDefault')}</Button>
        </div>
      </div>
      {toast.node}
    </>
  )
}
