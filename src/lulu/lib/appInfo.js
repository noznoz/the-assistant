// Single source of truth for the app version + build timestamp shown in the
// footers (More, Settings). Both values are injected by Vite at build time
// (see vite.config.js `define`): __APP_VERSION__ from package.json, __BUILD_TIME__
// as an ISO string. The `typeof` guards keep this safe under Vitest, where the
// defines aren't applied.

export const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || '0.0.0'

const BUILD_ISO = (typeof __BUILD_TIME__ !== 'undefined' && __BUILD_TIME__) || ''

// "06 Aug 2026 14:32" — a compact, locale-stable date+time, or "dev" when not
// built (e.g. `vite dev` without the define, or a test run).
export function buildStamp() {
  if (!BUILD_ISO) return 'dev'
  try {
    const d = new Date(BUILD_ISO)
    if (isNaN(d)) return 'dev'
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch { return 'dev' }
}

export const BUILD_STAMP = buildStamp()

// "v5.0.0 · 06 Aug 2026 14:32" — the standard footer label.
export const VERSION_LABEL = `v${APP_VERSION} · ${BUILD_STAMP}`
