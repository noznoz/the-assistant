import { supabase } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlB64ToUint8(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Returns: 'subscribed' | 'granted' | 'denied' | 'default' | 'unsupported' | 'no-vapid'
export async function getPushState() {
  if (!VAPID_PUBLIC_KEY) return 'no-vapid'
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) return 'subscribed'
  }
  return Notification.permission // 'granted' or 'default'
}

// Must be called from a user-gesture handler (button click) — required on iOS.
// Returns the new state string.
export async function subscribeToPush(riderName) {
  if (!VAPID_PUBLIC_KEY) return 'no-vapid'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission // 'denied' | 'default'

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8(VAPID_PUBLIC_KEY),
    })

    await supabase.from('push_subscriptions').upsert({
      rider_name: riderName,
      endpoint: sub.endpoint,
      subscription: sub.toJSON(),
    }, { onConflict: 'rider_name,endpoint' })

    return 'subscribed'
  } catch (err) {
    console.error('Push subscription failed:', err)
    return 'error'
  }
}
