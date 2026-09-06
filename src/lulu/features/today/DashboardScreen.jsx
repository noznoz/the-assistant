import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Button, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { normalizeDashboard, labelForSection } from '../../lib/dashboard.js'
import { normalizeQuickActions, quickActionDef } from '../../lib/quickActions.js'

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

  // Quick-actions grid (which buttons show + their order).
  const qa = normalizeQuickActions(settings.quickActions)
  const commitQa = (next) => updateSettings({ quickActions: next })
  const toggleQa = (id) => commitQa(qa.map(s => s.id === id ? { ...s, on: !s.on } : s))
  const moveQa = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= qa.length) return
    const next = qa.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    commitQa(next)
  }
  const resetQa = () => { commitQa(normalizeQuickActions([])); toast.show(t('savedToast')) }

  return (
    <>
      <DetailHeader title={t('customizeHome')} onBack={() => go('today')} />
      <div className="screen">
        <h2 className="member-h2" style={{ marginTop: 14 }}>{t('homeStyle')}</h2>
        <div className="chip-row" style={{ margin: '2px 0 6px' }}>
          {[
            { id: 'classic', label: t('homeClassic') }, { id: 'focus', label: t('homeFocus') },
            { id: 'cover', label: t('homeCover') }, { id: 'timeline', label: t('homeTimeline') },
            { id: 'bento', label: t('homeBento') },
          ].map(o => (
            <Chip key={o.id} selectable on={(settings.homeStyle || 'classic') === o.id} onClick={() => updateSettings({ homeStyle: o.id })}>{o.label}</Chip>
          ))}
        </div>
        <p className="hint" style={{ margin: '0 2px 18px' }}>{t('homeStyleHint')}</p>

        <h2 className="member-h2">{t('colorScheme')}</h2>
        <div className="accent-row">
          {[
            { id: 'amber', c: '#C8963E' }, { id: 'emerald', c: '#2E9E6B' }, { id: 'sapphire', c: '#3E7BC8' },
            { id: 'rose', c: '#D45D79' }, { id: 'violet', c: '#8B6DD8' }, { id: 'graphite', c: '#9A968C' },
          ].map(a => (
            <button key={a.id} className={`accent-sw ${(settings.accent || 'amber') === a.id ? 'on' : ''}`}
              onClick={() => updateSettings({ accent: a.id })} aria-label={t('accent_' + a.id)}>
              <span className="sw" style={{ background: a.c }}>{(settings.accent || 'amber') === a.id ? <Icon name="check" size={16} /> : null}</span>
              <span className="nm">{t('accent_' + a.id)}</span>
            </button>
          ))}
        </div>
        <p className="hint" style={{ margin: '10px 2px 16px' }}>{t('colorSchemeHint')}</p>

        <h2 className="member-h2">{t('cards')}</h2>
        <p className="hint" style={{ margin: '2px 2px 10px' }}>{t('customizeHint')}</p>
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

        <h2 className="member-h2" style={{ marginTop: 26 }}>{t('customizeQuick')}</h2>
        <p className="hint" style={{ margin: '2px 2px 10px' }}>{t('customizeQuickHint')}</p>
        <Card tight flat style={{ padding: 6 }}>
          {qa.map((s, i) => {
            const def = quickActionDef(s.id)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderTop: i ? '1px solid var(--line)' : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="iconbtn sm" aria-label={t('moveUp')} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1, width: 26, height: 22 }} onClick={() => moveQa(i, -1)}><Icon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                  <button className="iconbtn sm" aria-label={t('moveDown')} disabled={i === qa.length - 1} style={{ opacity: i === qa.length - 1 ? 0.3 : 1, width: 26, height: 22 }} onClick={() => moveQa(i, 1)}><Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                </div>
                <span className="lead" style={{ flexShrink: 0, opacity: s.on ? 1 : 0.5 }}><Icon name={def ? def.icon : 'sparkle'} size={18} /></span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 15, opacity: s.on ? 1 : 0.5 }}>{t(def ? def.key : s.id)}</span>
                <button onClick={() => toggleQa(s.id)} aria-label={t(def ? def.key : s.id)}
                  style={{ width: 46, height: 28, borderRadius: 14, border: 0, background: s.on ? 'var(--ok)' : 'var(--line-2)', position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, insetInlineStart: s.on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
                </button>
              </div>
            )
          })}
        </Card>
        <div style={{ marginTop: 16 }}>
          <Button block icon="refresh" onClick={resetQa}>{t('resetDefault')}</Button>
        </div>
      </div>
      {toast.node}
    </>
  )
}
