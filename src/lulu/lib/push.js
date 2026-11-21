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
// The key the phone subscribes with must match the server's private key, so
// ask the send-reminders function for it (it makes a pair on first use). A key
// built into the app (VITE_VAPID_PUBLIC_KEY) is only a fallback.
let serverKey = ''
export async function serverPublicKey() {
  if (serverKey) return serverKey
  if (!cloud.isReady || !cloud.isReady()) return ''
  try {
    const r = await cloud.invokeFunction('send-reminders', { action: 'key' })
    if (r && r.publicKey) serverKey = r.publicKey
  } catch { /* not deployed yet */ }
  return serverKey
}
async function pushKey() { return (await serverPublicKey()) || VAPID_PUBLIC }
export function pushConfigured() { return !!(VAPID_PUBLIC || serverKey) }

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

// Subscribe with `key`, replacing a subscription made with a different key
// (e.g. an old build-time key): the server could never reach that one.
function sameKey(sub, key) {
  try {
    const a = new Uint8Array(sub.options.applicationServerKey)
    const b = urlBase64ToUint8Array(key)
    return a.length === b.length && a.every((v, i) => v === b[i])
  } catch { return true } // can't tell — keep it
}
async function subscribeWith(reg, key) {
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub, key)) { try { await sub.unsubscribe() } catch { /* ignore */ } sub = null }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
  return sub
}

export async function isPushEnabled() {
  return !!(await currentSubscription())
}

// Ask permission, subscribe, and store the subscription in the household.
// Returns { ok, reason }. reason ∈ unsupported | not-configured | not-connected
// | denied | error.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (!cloud.isReady || !cloud.isReady()) return { ok: false, reason: 'not-connected' }
  const key = await pushKey()
  if (!key) return { ok: false, reason: 'not-configured' }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, reason: 'denied' }
    const reg = await navigator.serviceWorker.ready
    const sub = await subscribeWith(reg, key)
    const saved = await cloud.savePushSubscription(sub.toJSON())
    return saved === false ? { ok: false, reason: 'not-saved' } : { ok: true }
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
  if (!pushSupported()) return
  if (!cloud.isReady || !cloud.isReady()) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const key = await pushKey()
    if (!key) return
    const reg = await navigator.serviceWorker.ready
    const sub = await subscribeWith(reg, key)
    await cloud.savePushSubscription(sub.toJSON())
  } catch { /* ignore — best effort */ }
}

// Everything the checklist (lib/pushCheck.js) needs to know, gathered now.
export async function pushFacts() {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  const ios = /iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  let standalone = false
  try { standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true } catch { /* ignore */ }
  const sub = await currentSubscription()
  const facts = {
    ios, standalone, supported: pushSupported(),
    cloud: !!(cloud.isReady && cloud.isReady()),
    perm: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    subscribed: !!sub, server: null, serverErr: '',
  }
  if (facts.cloud) {
    try {
      facts.server = await cloud.invokeFunction('send-reminders', { action: 'status', household_id: cloud.householdId(), endpoint: sub ? sub.endpoint : '' })
      if (facts.server && facts.server.publicKey) serverKey = facts.server.publicKey
    } catch (e) { facts.serverErr = (e && e.message) || 'error' }
  }
  return facts
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  try { await cloud.deletePushSubscription(sub.endpoint) } catch { /* ignore */ }
  try { await sub.unsubscribe() } catch { /* ignore */ }
}
