import React from 'react'
import Icon from './Icon.jsx'
import { useT } from '../i18n/I18nProvider.jsx'

const TABS = [
  { id: 'today', icon: 'today' },
  { id: 'tasks', icon: 'check' },
  { id: 'garage', icon: 'car' },
  { id: 'expenses', icon: 'wallet' },
  { id: 'more', icon: 'grid' },
]

export function BottomNav({ tab, go }) {
  const { t } = useT()
  return (
    <nav className="bottomnav">
      {TABS.map(x => (
        <button key={x.id} className={`navbtn ${tab === x.id ? 'active' : ''}`} onClick={() => go(x.id)}>
          <Icon name={x.icon} size={24} stroke={tab === x.id ? 2.4 : 2} />
          {t(x.id)}
        </button>
      ))}
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
