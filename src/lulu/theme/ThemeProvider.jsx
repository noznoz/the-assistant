import React, { useEffect } from 'react'
import { useSettings } from '../store/StoreProvider.jsx'

// Applies the chosen theme (system | light | dark) to <html data-theme> and
// the color scheme (amber | emerald | …) to <html data-accent>.
export function ThemeProvider({ children }) {
  const { settings } = useSettings()
  const pref = settings.theme || 'system'
  const accent = settings.accent || 'amber'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref
      document.documentElement.setAttribute('data-theme', resolved)
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0A0B0E' : '#F4F1EC')
    }
    apply()
    if (pref === 'system') { mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply) }
  }, [pref])

  useEffect(() => {
    if (accent && accent !== 'amber') document.documentElement.setAttribute('data-accent', accent)
    else document.documentElement.removeAttribute('data-accent')
  }, [accent])

  return children
}
