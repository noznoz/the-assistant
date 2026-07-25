import React, { createContext, useContext, useEffect } from 'react'
import { STRINGS } from './strings.js'
import { useSettings } from '../store/StoreProvider.jsx'

const I18nCtx = createContext(null)

export function I18nProvider({ children }) {
  const { settings } = useSettings()
  const lang = settings.language || 'en'
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', dir)
  }, [lang, dir])

  const t = (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
  return <I18nCtx.Provider value={{ t, lang, dir }}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (!ctx) return { t: (k) => STRINGS.en[k] ?? k, lang: 'en', dir: 'ltr' }
  return ctx
}
