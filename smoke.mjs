// ============================================================================
// Runtime smoke test — loads every route in a real headless Chromium and fails
// if any screen throws an uncaught error or logs a console error. This is the
// automated layer described in docs/TESTING.md.
//
// Usage:
//   npm run build
//   node smoke.mjs
//
// It serves the built `dist/` itself (no external server needed) and drives the
// hash router (`#/<tab>`) through each screen. Chromium is located via
// PLAYWRIGHT_BROWSERS_PATH, falling back to the well-known preinstalled path.
// ============================================================================
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'

const ROOT = new URL('./dist/', import.meta.url).pathname
const PORT = Number(process.env.PORT) || 5199

// Every route the app's router understands (see src/lulu/LuluApp.jsx).
const ROUTES = [
  'today', 'tasks', 'garage', 'expenses', 'more', 'inbox', 'people', 'documents',
  'trips', 'reports', 'notifications', 'calendar', 'settings', 'profile', 'notes',
  'projects', 'expensereport', 'budgets', 'subscriptions', 'rewards', 'groups',
  'income', 'investments', 'accounts', 'networth', 'zakat', 'trends', 'liabilities',
  'moneycal', 'statement', 'properties', 'valuables', 'week', 'memberships',
  'renewals', 'monthlyreport', 'boardpack', 'forecast', 'emergency', 'wishlist',
  'goals', 'dashboard', 'appointments', 'occasions', 'staff', 'debtpayoff', 'hijri',
  'allocation', 'work', 'workboard', 'meetings', 'orgchart', 'followup', 'spiritual',
  'giving', 'keepintouch', 'navtabs', 'assistant', 'cloud', 'search', 'reminders',
]

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
}

// Console errors that are environmental, not app bugs (no network in headless CI).
const BENIGN = [/Failed to load resource/i, /net::ERR/i, /ERR_INTERNET/i, /manifest/i, /service ?worker/i, /favicon/i]

if (!existsSync(ROOT) || !existsSync(join(ROOT, 'index.html'))) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0])
    let file = normalize(join(ROOT, url === '/' ? 'index.html' : url))
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return }
    if (!existsSync(file)) file = join(ROOT, 'index.html') // SPA fallback
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(500).end('error')
  }
})

await new Promise((r) => server.listen(PORT, r))

const execPath = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium'
const browser = await chromium.launch({
  ...(existsSync(execPath) ? { executablePath: execPath } : {}),
  args: ['--no-sandbox'],
})
const page = await browser.newPage()

const errors = []
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const text = m.text()
  if (BENIGN.some((re) => re.test(text))) return
  errors.push(`[console] ${page.url().split('#')[1] || '/'} :: ${text}`)
})
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${page.url().split('#')[1] || '/'} :: ${e.message}`)
})

let visited = 0
for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}/#/${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(120) // let the screen settle/render
  // Sanity: the bottom nav must be present, proving the shell mounted.
  const mounted = await page.locator('.app, .bottom-nav, nav').first().count()
  if (!mounted) errors.push(`[mount] #/${route} :: app shell did not render`)
  visited++
}

await browser.close()
server.close()

console.log(`Visited ${visited}/${ROUTES.length} routes.`)
console.log(`ERROR_COUNT: ${errors.length}`)
if (errors.length) {
  console.error('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('Smoke test passed — every route rendered with no errors.')
