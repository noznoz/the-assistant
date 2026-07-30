// Custom service worker.
// Update strategy:
//  • HTML/navigation  → network-first (so a new deploy loads immediately when
//    online; falls back to the cached shell when offline).
//  • Hashed assets    → cache-first with background refresh (immutable by hash).
// Bumping CACHE purges every older cache on activate.

const CACHE = 'assistant-v2'
const PRECACHE = self.__WB_MANIFEST || []

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Resilient: don't let one failed asset abort the whole install.
      Promise.allSettled(
        PRECACHE.map((entry) => c.add(typeof entry === 'string' ? entry : entry.url))
      )
    )
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim()
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  })())
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch { return }
  if (url.origin !== self.location.origin) return

  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')

  if (isHTML) {
    // Network-first: always try the freshest app shell.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
    )
    return
  }

  // Static assets: serve from cache, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})

// ---- Push notifications (used once a server sends them) ----
self.addEventListener('push', (e) => {
  if (!e.data) return
  let data
  try { data = e.data.json() } catch { data = { title: 'The Assistant', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(data.title || 'The Assistant', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'the-assistant',
      renotify: true,
      data: { url: data.url || self.registration.scope },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      if (cs.length) return cs[0].focus()
      return clients.openWindow(e.notification.data?.url || self.registration.scope)
    })
  )
})
