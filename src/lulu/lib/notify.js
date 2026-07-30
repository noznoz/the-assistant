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

// Fire the daily brief at most once per calendar day.
const BRIEF_KEY = 'lulu:lastBrief'
export async function maybeDailyBrief(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(BRIEF_KEY) === today) return
  localStorage.setItem(BRIEF_KEY, today)
  await showNotification(title, body)
}
