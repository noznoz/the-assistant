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

  // Background alerts for any other dated item that is due today or overdue —
  // tasks, appointments, subscriptions, expiries, birthdays. Mirrors the app's
  // on-device "due today" alerts so they arrive while the app is closed too.
  // De-duplicated per (household, alert_key) in push_alerts so each fires once.
  // Wrapped so a missing push_alerts table never breaks the reminders path.
  let alerts = 0
  try { alerts = await runDatedAlerts(supabase) } catch (_e) { alerts = -1 /* push_alerts not set up */ }

  return json({ due: due.length, sent, alerts })
})

// ---- Dated-item background alerts --------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0')
function todayStr() { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
const dateOnly = (v: unknown) => typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null

// Compute the due-today / overdue alerts for one household's records.
function computeDueAlerts(recs: any[], today: string) {
  const out: { key: string; title: string; body: string }[] = []
  const of = (col: string) => recs.filter(r => r.collection === col && r.data && !r.data.deletedAt).map(r => r.data)

  for (const x of of('tasks')) {
    if (x.status === 'completed' || x.status === 'cancelled') continue
    const dd = dateOnly(x.dueDate); if (!dd || dd > today) continue
    out.push({ key: `task:${x.id}:${dd}`, title: dd < today ? 'Overdue task' : 'Task due today', body: x.title || 'Task' })
  }
  for (const x of of('appointments')) {
    const dd = dateOnly(x.date); if (dd !== today) continue
    out.push({ key: `appt:${x.id}:${dd}`, title: 'Appointment today', body: `${x.title || 'Appointment'}${x.time ? ` · ${x.time}` : ''}` })
  }
  for (const x of of('subscriptions')) {
    if (x.active === false) continue
    const dd = dateOnly(x.nextDue); if (!dd || dd > today) continue
    out.push({ key: `sub:${x.id}:${dd}`, title: 'Payment due', body: x.name || 'Subscription' })
  }
  for (const x of of('documents')) {
    const dd = dateOnly(x.expiry); if (!dd || dd > today) continue
    out.push({ key: `doc:${x.id}:${dd}`, title: 'Document expiring', body: x.title || 'Document' })
  }
  for (const x of of('vehicles')) {
    const dd = dateOnly(x.policyExpiry); if (!dd || dd > today) continue
    out.push({ key: `veh:${x.id}:${dd}`, title: 'Insurance expiring', body: `${x.nickname || x.name || 'Vehicle'} — insurance` })
  }
  for (const x of of('valuables')) {
    const dd = dateOnly(x.warrantyExpiry); if (!dd || dd > today) continue
    out.push({ key: `war:${x.id}:${dd}`, title: 'Warranty ending', body: `${x.name || 'Item'} — warranty` })
  }
  const idFields: [string, string][] = [['iqamaExpiry', 'Iqama'], ['passportExpiry', 'Passport'], ['licenseExpiry', 'Licence'], ['nationalIdExpiry', 'National ID']]
  const year = today.slice(0, 4)
  for (const x of of('people')) {
    const b = dateOnly(x.birthday)
    if (b && b.slice(5) === today.slice(5)) out.push({ key: `bd:${x.id}:${year}`, title: 'Birthday today', body: x.name || 'Someone' })
    for (const [f, label] of idFields) {
      const dd = dateOnly(x[f]); if (!dd || dd > today) continue
      out.push({ key: `${f}:${x.id}:${dd}`, title: `${label} expiring`, body: x.name || label })
    }
  }
  return out
}

async function runDatedAlerts(supabase: any) {
  const today = todayStr()
  const { data: recs } = await supabase.from('records')
    .select('household_id,collection,data')
    .in('collection', ['tasks', 'appointments', 'subscriptions', 'documents', 'vehicles', 'valuables', 'people'])

  const byHouse = new Map<string, any[]>()
  for (const r of recs ?? []) {
    if (!byHouse.has(r.household_id)) byHouse.set(r.household_id, [])
    byHouse.get(r.household_id)!.push(r)
  }

  let alerts = 0
  for (const [hid, list] of byHouse) {
    const items = computeDueAlerts(list, today)
    if (!items.length) continue
    const keys = items.map(i => i.key)
    const { data: seenRows } = await supabase.from('push_alerts').select('alert_key').eq('household_id', hid).in('alert_key', keys)
    const seen = new Set((seenRows ?? []).map((r: any) => r.alert_key))
    const fresh = items.filter(i => !seen.has(i.key))
    if (!fresh.length) continue
    const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,subscription').eq('household_id', hid)
    if (!subs || !subs.length) continue // no device yet — leave un-sent so it fires once they subscribe
    for (const it of fresh) {
      const payload = JSON.stringify({ title: it.title, body: it.body, tag: 'due-' + it.key })
      let delivered = false
      for (const s of subs) {
        try { await webpush.sendNotification((s as any).subscription, payload); delivered = true }
        catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await supabase.from('push_subscriptions').delete().eq('endpoint', (s as any).endpoint) }
      }
      if (delivered) { alerts++; await supabase.from('push_alerts').insert({ household_id: hid, alert_key: it.key }) }
    }
  }
  return alerts
}
