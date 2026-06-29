// Custom service worker: precache + push notifications

const CACHE = 'rh-v3'
const PRECACHE = self.__WB_MANIFEST || []

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(PRECACHE.map(entry => (typeof entry === 'string' ? entry : entry.url)))
    )
  )
})

self.addEventListener('activate', e => {
  self.clients.claim()
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})

// Push received from server → show system notification
self.addEventListener('push', e => {
  if (!e.data) return
  let data
  try { data = e.data.json() } catch { data = { title: 'Road Heaven', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Road Heaven', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'road-heaven',
      renotify: true,
      data: { url: '/' },
    })
  )
})

// Tap notification → focus or open the app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      if (cs.length) return cs[0].focus()
      return clients.openWindow(e.notification.data?.url || '/')
    })
  )
})
