import React, { useEffect } from 'react'
import { useSettings } from '../store/StoreProvider.jsx'

// Applies the chosen theme (system | light | dark) to <html data-theme>, the
// color scheme (amber | emerald | …) to <html data-accent>, and the text size
// (standard | large) to <html data-text>.
export function ThemeProvider({ children }) {
  const { settings } = useSettings()
  const pref = settings.theme || 'system'
  const accent = settings.accent || 'amber'
  const textSize = settings.textSize || 'standard'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref
      document.documentElement.setAttribute('data-theme', resolved)
      // Both theme-color metas (light/dark media) carry the resolved color, so
      // the status bar matches the app even when it differs from the OS theme.
      document.querySelectorAll('meta[name="theme-color"]').forEach(meta =>
        meta.setAttribute('content', resolved === 'dark' ? '#15120E' : '#F7F4EF'))
    }
    apply()
    if (pref === 'system') { mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply) }
  }, [pref])

  useEffect(() => {
    if (accent && accent !== 'amber') document.documentElement.setAttribute('data-accent', accent)
    else document.documentElement.removeAttribute('data-accent')
  }, [accent])

  useEffect(() => {
    if (textSize === 'large') document.documentElement.setAttribute('data-text', 'large')
    else document.documentElement.removeAttribute('data-text')
  }, [textSize])

  return children
}
