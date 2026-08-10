// ============================================================================
// send-reminders — Supabase Edge Function (Deno).
//
// Delivers due personal reminders as Web Push so they arrive even when the app
// is closed. Intended to run on a schedule (pg_cron, every minute) — see
// docs/PUSH.md for full setup.
//
// Reminders live in the shared `records` table (collection = 'reminders'); this
// function finds ones whose remindAt has passed and that haven't fired yet,
// pushes to every push_subscription in that household, and marks the record
// notified so it isn't sent again. Push subscriptions that have expired
// (404/410) are cleaned up.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com).
// ============================================================================
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

// Allow the app (a different origin) to invoke this for the in-app test push.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys not configured' }, 500)
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const nowIso = new Date().toISOString()

  // Test mode: the app posts { test: true, household_id }. Send one test push to
  // that household's subscriptions right now so the whole pipeline can be
  // verified on demand (no due reminder needed). Dead subscriptions are pruned.
  let body: any = {}
  try { body = await req.json() } catch { /* cron sends no body */ }
  if (body && body.test) {
    const hid = body.household_id
    if (!hid) return json({ error: 'household_id required' }, 400)
    const { data: subs } = await supabase
      .from('push_subscriptions').select('endpoint,subscription').eq('household_id', hid)
    const payload = JSON.stringify({ title: 'Test push ✅', body: 'Background reminders are working.', tag: 'lulu-test' })
    let sent = 0
    for (const s of subs ?? []) {
      try { await webpush.sendNotification((s as any).subscription, payload); sent++ }
      catch (e: any) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', (s as any).endpoint)
        }
      }
    }
    return json({ test: true, subscriptions: (subs ?? []).length, sent })
  }

  const { data: recs, error } = await supabase
    .from('records').select('household_id,id,data').eq('collection', 'reminders')
  if (error) return json({ error: error.message }, 500)

  // A reminder carries up to 3 alert times (`times`) and `firedCount` (how many
  // of the earliest have alerted). Legacy records use `remindAt` + `notified`.
  const normalize = (d: any) => {
    const times = (Array.isArray(d.times) && d.times.length)
      ? [...new Set(d.times.filter(Boolean))].sort()
      : (d.remindAt ? [d.remindAt] : [])
    const firedCount = (typeof d.firedCount === 'number') ? d.firedCount : (d.notified ? times.length : 0)
    const passed = times.filter((t: string) => t <= nowIso).length
    return { times, firedCount, passed }
  }

  const due = (recs ?? []).filter((r: any) => {
    const d = r.data || {}
    if (d.done || d.deletedAt) return false
    const { firedCount, passed } = normalize(d)
    return passed > firedCount
  })

  let sent = 0
  for (const r of due) {
    const { data: subs } = await supabase
      .from('push_subscriptions').select('endpoint,subscription').eq('household_id', r.household_id)
    const payload = JSON.stringify({ title: 'Reminder', body: (r as any).data.text || '', tag: 'reminder-' + (r as any).id })
    let delivered = false
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification((s as any).subscription, payload)
        delivered = true
      } catch (e: any) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', (s as any).endpoint)
        }
      }
    }
    if (delivered) {
      sent++
      const { times, passed } = normalize((r as any).data)
      const remindAt = times[Math.min(passed, times.length - 1)] || null
      await supabase.from('records')
        .update({ data: { ...(r as any).data, firedCount: passed, remindAt, notified: passed >= times.length, notifiedAt: nowIso }, updated_at: nowIso })
        .eq('household_id', (r as any).household_id).eq('id', (r as any).id)
    }
  }
  return json({ due: due.length, sent })
})
