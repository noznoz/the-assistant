// On-device notifications + app icon badge. These fire when the app is opened
// or brought to the foreground (a PWA can't run background timers on iOS —
// scheduled push while the app is closed arrives with the cloud step later).
import { playAlarm } from './alarm.js'

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

// Fire a sound alert for any dated item that is due today or overdue — tasks,
// appointments, subscriptions, birthdays, installments, renewals on their day,
// etc. Driven by the notification feed's `soon` flag so there's a single source
// of truth. De-duplicated per feed-item id (one ping each), and self-pruning:
// ids that leave the "soon" set are forgotten so a recurring item (e.g. next
// year's birthday) can alert again. Reminders fire via their own path.
const DUE_ALERT_KEY = 'lulu:dueAlerts'

export async function runDueAlerts(feed = [], { enabled, heading, sound } = {}) {
  if (!enabled) return
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  let sent
  try { sent = JSON.parse(localStorage.getItem(DUE_ALERT_KEY) || '{}') } catch { sent = {} }
  if (!sent || typeof sent !== 'object') sent = {}
  const soon = (feed || []).filter(it => it && it.soon)
  const soonIds = new Set(soon.map(it => it.id))
  let changed = false
  let fired = 0
  for (const it of soon) {
    if (sent[it.id]) continue
    // eslint-disable-next-line no-await-in-loop
    await showNotification(heading || 'Due today', it.meta ? `${it.title} · ${it.meta}` : it.title, 'due-' + it.id)
    sent[it.id] = new Date().toISOString().slice(0, 10)
    changed = true
    fired++
  }
  for (const k of Object.keys(sent)) { if (!soonIds.has(k)) { delete sent[k]; changed = true } }
  if (changed) { try { localStorage.setItem(DUE_ALERT_KEY, JSON.stringify(sent)) } catch { /* ignore */ } }
  if (fired && sound && typeof document !== 'undefined' && document.visibilityState === 'visible') playAlarm()
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
