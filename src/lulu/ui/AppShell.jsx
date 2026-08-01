import React from 'react'
import Icon from './Icon.jsx'
import { useT } from '../i18n/I18nProvider.jsx'
import { useSettings } from '../store/StoreProvider.jsx'

// Sections that may occupy the middle bottom-bar slots (Today and More are fixed).
export const NAV_SECTIONS = {
  tasks: { icon: 'check' },
  garage: { icon: 'car' },
  expenses: { icon: 'wallet', labelKey: 'myFinance' },
  work: { icon: 'report' },
  people: { icon: 'people' },
  week: { icon: 'calendar', labelKey: 'weekAhead' },
  calendar: { icon: 'clock' },
  properties: { icon: 'doc' },
  trips: { icon: 'trip' },
  documents: { icon: 'doc' },
  spiritual: { icon: 'sparkle' },
  giving: { icon: 'gift' },
}
export const DEFAULT_NAV = ['tasks', 'work', 'expenses']

export function navMiddle(settings) {
  const chosen = (settings?.navTabs && settings.navTabs.length ? settings.navTabs : DEFAULT_NAV)
    .filter(id => NAV_SECTIONS[id])
  return chosen.slice(0, 4)
}

export function BottomNav({ tab, go }) {
  const { t } = useT()
  const { settings } = useSettings()
  const tabs = ['today', ...navMiddle(settings), 'more']
  const metaFor = (id) => id === 'today' ? { icon: 'today' } : id === 'more' ? { icon: 'grid' } : NAV_SECTIONS[id]
  return (
    <nav className="bottomnav">
      {tabs.map(id => {
        const meta = metaFor(id)
        return (
          <button key={id} className={`navbtn ${tab === id ? 'active' : ''}`} onClick={() => go(id)}>
            <Icon name={meta.icon} size={24} stroke={tab === id ? 2.4 : 2} />
            {t(meta.labelKey || id)}
          </button>
        )
      })}
    </nav>
  )
}

export function TopBar({ title, sub, right }) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </div>
  )
}
