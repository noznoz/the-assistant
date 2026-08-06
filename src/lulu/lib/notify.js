// On-device notifications + app icon badge. These fire when the app is opened
// or brought to the foreground (a PWA can't run background timers on iOS —
// scheduled push while the app is closed arrives with the cloud step later).

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  try { return await Notification.requestPermission() } catch { return 'denied' }
}

// Red count on the home-screen icon (installed PWAs, iOS 16.4+).
export function setBadge(count) {
  try {
    if (count > 0 && navigator.setAppBadge) navigator.setAppBadge(count)
    else if (navigator.clearAppBadge) navigator.clearAppBadge()
  } catch { /* unsupported */ }
}

export async function showNotification(title, body, tag = 'the-assistant') {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const opts = { body, tag, renotify: true, icon: 'icon-192.png', badge: 'icon-192.png' }
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration())
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return }
    // eslint-disable-next-line no-new
    new Notification(title, opts)
  } catch { /* ignore */ }
}

// Fire on-device renewal reminders at 30 / 14 / 7 / 1 days before each expiry.
// De-duplicated per (item id + expiry date + threshold) so every crossing pings
// exactly once; a renewed item (new expiry date) rearms because the date is part
// of the key. Respects the caller's notifications toggle + granted permission.
const RENEWAL_KEY = 'lulu:renewalReminders'
const RENEWAL_THRESHOLDS = [30, 14, 7, 1]

export async function runRenewalReminders(items = [], { enabled, heading } = {}) {
  if (!enabled) return
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  let sent
  try { sent = JSON.parse(localStorage.getItem(RENEWAL_KEY) || '{}') } catch { sent = {} }
  if (!sent || typeof sent !== 'object') sent = {}
  let changed = false
  for (const it of items) {
    if (!it || it.days == null || !RENEWAL_THRESHOLDS.includes(it.days)) continue
    const key = `${it.id}@${it.date}@${it.days}`
    if (sent[key]) continue
    const body = it.sub ? `${it.title} · ${it.sub}` : it.title
    // eslint-disable-next-line no-await-in-loop
    await showNotification(heading || 'Renewal reminder', body, `renewal-${it.id}`)
    sent[key] = new Date().toISOString().slice(0, 10)
    changed = true
  }
  if (changed) { try { localStorage.setItem(RENEWAL_KEY, JSON.stringify(sent)) } catch { /* ignore */ } }
}

// Fire the daily brief at most once per calendar day.
const BRIEF_KEY = 'lulu:lastBrief'
export async function maybeDailyBrief(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(BRIEF_KEY) === today) return
  localStorage.setItem(BRIEF_KEY, today)
  await showNotification(title, body)
}
