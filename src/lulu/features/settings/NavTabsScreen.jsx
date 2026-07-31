import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { NAV_SECTIONS, DEFAULT_NAV, navMiddle } from '../../ui/AppShell.jsx'

const MAX = 4

// Choose which sections fill the middle bottom-bar slots (Today + More fixed).
export default function NavTabsScreen({ go }) {
  const { t } = useT()
  const { settings, updateSettings } = useSettings()
  const toast = useToast()
  const mid = navMiddle(settings)
  const label = (id) => t(NAV_SECTIONS[id]?.labelKey || id)

  const commit = (next) => updateSettings({ navTabs: next })
  const remove = (id) => { if (mid.length > 1) commit(mid.filter(x => x !== id)) }
  const add = (id) => { if (mid.length < MAX) commit([...mid, id]) }
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= mid.length) return
    const next = mid.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  const available = Object.keys(NAV_SECTIONS).filter(id => !mid.includes(id))

  const Fixed = ({ id, icon }) => (
    <div className="li" style={{ opacity: 0.55 }}>
      <div className="lead" style={{ background: 'var(--surface-2)' }}><Icon name={icon} size={18} /></div>
      <div className="body"><div className="title">{t(id)}</div><div className="meta">{t('alwaysShown')}</div></div>
    </div>
  )

  return (
    <>
      <DetailHeader title={t('bottomTabs')} onBack={() => go('settings')} />
      <div className="screen">
        <p className="hint" style={{ margin: '14px 2px 10px' }}>{t('bottomTabsHint')}</p>

        <Section title={t('inYourBar')} count={mid.length + 2} />
        <Card tight flat style={{ padding: 6 }}>
          <Fixed id="today" icon="today" />
          {mid.map((id, i) => (
            <div key={id} className="li">
              <div className="lead t-brand"><Icon name={NAV_SECTIONS[id].icon} size={18} /></div>
              <div className="body" style={{ fontWeight: 600 }}>{label(id)}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button className="iconbtn sm" aria-label={t('moveUp')} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1, width: 26, height: 20 }} onClick={() => move(i, -1)}><Icon name="chevron" size={13} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button className="iconbtn sm" aria-label={t('moveDown')} disabled={i === mid.length - 1} style={{ opacity: i === mid.length - 1 ? 0.3 : 1, width: 26, height: 20 }} onClick={() => move(i, 1)}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} /></button>
              </div>
              <button className="iconbtn" aria-label={t('remove')} onClick={() => remove(id)} style={{ marginInlineStart: 4, color: 'var(--danger)', opacity: mid.length > 1 ? 1 : 0.3 }}><Icon name="x" size={16} /></button>
            </div>
          ))}
          <Fixed id="more" icon="grid" />
        </Card>
        {mid.length >= MAX && <p className="hint" style={{ margin: '6px 2px 0' }}>{t('maxTabs')}</p>}

        <Section title={t('availableSections')} count={available.length} />
        <Card tight flat style={{ padding: 6 }}>
          {available.map(id => (
            <div key={id} className="li">
              <div className="lead" style={{ background: 'var(--surface-2)' }}><Icon name={NAV_SECTIONS[id].icon} size={18} /></div>
              <div className="body" style={{ fontWeight: 600 }}>{label(id)}</div>
              <button className="btn sm" disabled={mid.length >= MAX} style={{ opacity: mid.length >= MAX ? 0.4 : 1 }} onClick={() => add(id)}><Icon name="plus" size={13} /> {t('add')}</button>
            </div>
          ))}
        </Card>

        <div style={{ marginTop: 16 }}>
          <Button block icon="refresh" onClick={() => { commit(DEFAULT_NAV); toast.show(t('savedToast')) }}>{t('resetDefault')}</Button>
        </div>
      </div>
      {toast.node}
    </>
  )
}
