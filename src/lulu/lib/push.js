// ============================================================================
// Web push (background reminders). Subscribes this device to push and stores the
// subscription in the household so a scheduled Supabase function can deliver
// reminders while the app is closed. Everything here is feature-detected and a
// safe no-op until VAPID + cloud are configured — so it never affects the app
// for users who don't enable it.
//
// Setup (see docs/PUSH.md): set VITE_VAPID_PUBLIC_KEY at build time, deploy the
// send-reminders Edge Function with the matching private key, run the SQL, and
// (on iPhone) install the app to the Home Screen.
// ============================================================================
import * as cloud from './cloud.js'

const VAPID_PUBLIC = (() => {
  try { return (import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY) || '' } catch { return '' }
})()

export function pushSupported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
    typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window
}
export function pushConfigured() { return !!VAPID_PUBLIC }

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return reg ? await reg.pushManager.getSubscription() : null
  } catch { return null }
}

export async function isPushEnabled() {
  return !!(await currentSubscription())
}

// Ask permission, subscribe, and store the subscription in the household.
// Returns { ok, reason }. reason ∈ unsupported | not-configured | not-connected
// | denied | error.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (!pushConfigured()) return { ok: false, reason: 'not-configured' }
  if (!cloud.isReady || !cloud.isReady()) return { ok: false, reason: 'not-connected' }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, reason: 'denied' }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    await cloud.savePushSubscription(sub.toJSON())
    return { ok: true }
  } catch { return { ok: false, reason: 'error' } }
}

// Keep the stored subscription alive. iOS/Safari can silently drop a PWA's push
// subscription (reboots, updates, days unopened); once that happens no
// background reminder arrives until the user re-enables it. Called on every app
// open: if push was enabled (permission already granted), make sure a live
// subscription exists — re-subscribing if iOS dropped it — and re-save it to the
// household so the scheduled function can always reach this device. Fully silent:
// it never prompts and no-ops unless push is configured, connected and granted.
export async function refreshPush() {
  if (!pushSupported() || !pushConfigured()) return
  if (!cloud.isReady || !cloud.isReady()) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    await cloud.savePushSubscription(sub.toJSON())
  } catch { /* ignore — best effort */ }
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  try { await cloud.deletePushSubscription(sub.endpoint) } catch { /* ignore */ }
  try { await sub.unsubscribe() } catch { /* ignore */ }
}
