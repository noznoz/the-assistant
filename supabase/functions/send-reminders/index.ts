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
  const nowMs = Date.now()
  const nextRepeatTimes = (times: string[], repeat: string) => {
    const ds = times.map(t => new Date(t)).filter(d => !isNaN(d.getTime()))
    if (!ds.length) return times
    let guard = 0
    do {
      ds.forEach(d => { repeat === 'monthly' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + (repeat === 'weekly' ? 7 : 1)) })
      guard++
    } while (Math.max(...ds.map(d => d.getTime())) <= nowMs && guard < 400)
    return ds.map(d => d.toISOString())
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
      const d = (r as any).data
      const { times, passed } = normalize(d)
      const repeat = d.repeat
      // Fully fired + repeating → roll forward to the next occurrence.
      if (passed >= times.length && repeat && repeat !== 'none') {
        const nt = nextRepeatTimes(times, repeat)
        await supabase.from('records')
          .update({ data: { ...d, times: nt, firedCount: 0, remindAt: nt[0], notified: false, notifiedAt: nowIso }, updated_at: nowIso })
          .eq('household_id', (r as any).household_id).eq('id', (r as any).id)
      } else {
        const remindAt = times[Math.min(passed, times.length - 1)] || null
        await supabase.from('records')
          .update({ data: { ...d, firedCount: passed, remindAt, notified: passed >= times.length, notifiedAt: nowIso }, updated_at: nowIso })
          .eq('household_id', (r as any).household_id).eq('id', (r as any).id)
      }
    }
  }

  // Background alerts for any other dated item that is due today or overdue —
  // tasks, appointments, subscriptions, expiries, birthdays. Mirrors the app's
  // on-device "due today" alerts so they arrive while the app is closed too.
  // De-duplicated per (household, alert_key) in push_alerts so each fires once.
  // Wrapped so a missing push_alerts table never breaks the reminders path.
  let alerts = 0
  try { alerts = await runDatedAlerts(supabase) } catch (_e) { alerts = -1 /* push_alerts not set up */ }

  let brief = 0
  try { brief = await runDailyBrief(supabase) } catch (_e) { brief = -1 }

  return json({ due: due.length, sent, alerts, brief })
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

// ---- Daily "start my day" brief -------------------------------------------
// Once per household per morning, at/after 07:30 Asia/Riyadh (a fixed +3h, no
// DST in Saudi), push a concise brief. Windowed to 07:30–10:00 so a late cron
// run doesn't deliver it mid-day; de-duplicated per day via push_alerts.
function riyadhParts() {
  const l = new Date(Date.now() + 3 * 3600 * 1000)
  return { date: l.toISOString().slice(0, 10), mins: l.getUTCHours() * 60 + l.getUTCMinutes() }
}

function briefBody(recs: any[], today: string) {
  const of = (col: string) => recs.filter(r => r.collection === col && r.data && !r.data.deletedAt).map(r => r.data)
  const open = of('tasks').filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter((t: any) => dateOnly(t.dueDate) === today)
  const overdue = open.filter((t: any) => { const d = dateOnly(t.dueDate); return d && d < today })
  const appts = of('appointments').filter((a: any) => dateOnly(a.date) === today).sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''))
  const rem = of('reminders').filter((r: any) => !r.done && r.remindAt && dateOnly(r.remindAt) <= today)
  const parts: string[] = []
  if (dueToday.length) parts.push(`${dueToday.length} due today`)
  if (overdue.length) parts.push(`${overdue.length} overdue`)
  if (appts.length) parts.push(`${appts[0].time ? appts[0].time + ' ' : ''}${appts[0].title}${appts.length > 1 ? ` +${appts.length - 1}` : ''}`)
  if (rem.length) parts.push(`${rem.length} reminder${rem.length > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : 'Your day is clear.'
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
const riyadhTime = (iso: string) => { try { return new Date(new Date(iso).getTime() + 3 * 3600 * 1000).toISOString().slice(11, 16) } catch { return '' } }

// Fuller brief for the email body (the push stays concise). Returns text + HTML.
function emailBrief(list: any[], date: string) {
  const of = (col: string) => list.filter(r => r.collection === col && r.data && !r.data.deletedAt).map(r => r.data)
  const open = of('tasks').filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter((t: any) => dateOnly(t.dueDate) === date)
  const overdue = open.filter((t: any) => { const d = dateOnly(t.dueDate); return d && d < date })
  const waiting = open.filter((t: any) => t.status === 'waiting_me')
  const appts = of('appointments').filter((a: any) => dateOnly(a.date) === date).sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''))
  const rem = of('reminders').filter((r: any) => !r.done && r.remindAt && dateOnly(r.remindAt) <= date).sort((a: any, b: any) => String(a.remindAt).localeCompare(String(b.remindAt)))

  const L: string[] = ['Good morning.', '', 'AGENDA']
  appts.forEach((a: any) => L.push(`  ${a.time || '—'}  ${a.title || 'Appointment'}`))
  rem.forEach((r: any) => L.push(`  ${riyadhTime(r.remindAt)}  (reminder) ${r.text || ''}`))
  if (dueToday.length) L.push(`  Due today: ${dueToday.map((t: any) => t.title).filter(Boolean).join(', ')}`)
  if (!appts.length && !rem.length && !dueToday.length) L.push('  Nothing scheduled today.')
  if (overdue.length || waiting.length) {
    L.push('', 'NEEDS ATTENTION')
    if (overdue.length) L.push(`  ${overdue.length} overdue: ${overdue.slice(0, 5).map((t: any) => t.title).join(', ')}`)
    if (waiting.length) L.push(`  ${waiting.length} waiting on you`)
  }
  L.push('', '— The Assistant')
  const text = L.join('\n')

  const rows: string[] = []
  appts.forEach((a: any) => rows.push(`<tr><td style="padding:3px 12px 3px 0;color:#9a7b3a;white-space:nowrap">${esc(a.time || '—')}</td><td style="padding:3px 0">${esc(a.title || 'Appointment')}</td></tr>`))
  rem.forEach((r: any) => rows.push(`<tr><td style="padding:3px 12px 3px 0;color:#9a7b3a;white-space:nowrap">${esc(riyadhTime(r.remindAt))}</td><td style="padding:3px 0">🔔 ${esc(r.text || '')}</td></tr>`))
  const dueRow = dueToday.length ? `<p style="margin:6px 0;color:#333"><b>Due today:</b> ${esc(dueToday.map((t: any) => t.title).filter(Boolean).join(', '))}</p>` : ''
  const emptyRow = (!appts.length && !rem.length && !dueToday.length) ? '<p style="color:#777;margin:6px 0">Nothing scheduled today.</p>' : ''
  const attention = (overdue.length || waiting.length)
    ? `<h3 style="margin:18px 0 6px;font-size:14px;letter-spacing:.04em;color:#b4462f;text-transform:uppercase">Needs attention</h3>` +
      (overdue.length ? `<p style="margin:4px 0;color:#333">🔴 ${overdue.length} overdue: ${esc(overdue.slice(0, 5).map((t: any) => t.title).join(', '))}</p>` : '') +
      (waiting.length ? `<p style="margin:4px 0;color:#333">🟠 ${waiting.length} waiting on you</p>` : '')
    : ''
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#222">` +
    `<h2 style="font-size:20px;margin:0 0 4px">☀️ Good morning</h2>` +
    `<h3 style="margin:16px 0 6px;font-size:14px;letter-spacing:.04em;color:#6b6a60;text-transform:uppercase">Agenda</h3>` +
    (rows.length ? `<table style="border-collapse:collapse;font-size:14px">${rows.join('')}</table>` : '') + dueRow + emptyRow +
    attention +
    `<p style="margin-top:22px;color:#999;font-size:12px">— The Assistant</p></div>`
  return { text, html }
}

async function sendBriefEmail(to: string[], subject: string, text: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key || !to.length) return false
  const from = Deno.env.get('BRIEF_FROM') || 'The Assistant <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text, html }),
    })
    return res.ok
  } catch { return false }
}

async function runDailyBrief(supabase: any) {
  const { date, mins } = riyadhParts()
  if (mins < 7 * 60 + 30 || mins >= 10 * 60) return 0 // only the 07:30–10:00 window
  const key = `brief:${date}`
  const { data: recs } = await supabase.from('records')
    .select('household_id,collection,data')
    .in('collection', ['tasks', 'appointments', 'reminders'])
  const byHouse = new Map<string, any[]>()
  for (const r of recs ?? []) {
    if (!byHouse.has(r.household_id)) byHouse.set(r.household_id, [])
    byHouse.get(r.household_id)!.push(r)
  }
  let sent = 0
  for (const [hid, list] of byHouse) {
    const { data: seen } = await supabase.from('push_alerts').select('alert_key').eq('household_id', hid).eq('alert_key', key)
    if (seen && seen.length) continue // already sent today
    let delivered = false

    // Push to every device in the household.
    const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,subscription').eq('household_id', hid)
    if (subs && subs.length) {
      const payload = JSON.stringify({ title: '☀️ Good morning', body: briefBody(list, date), tag: 'daily-brief' })
      for (const s of subs) {
        try { await webpush.sendNotification((s as any).subscription, payload); delivered = true }
        catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await supabase.from('push_subscriptions').delete().eq('endpoint', (s as any).endpoint) }
      }
    }

    // Email the fuller brief to the household's members (needs RESEND_API_KEY).
    const { data: members } = await supabase.from('household_members').select('email').eq('household_id', hid)
    const emails = [...new Set((members ?? []).map((m: any) => m.email).filter(Boolean))] as string[]
    if (emails.length) {
      const { text, html } = emailBrief(list, date)
      if (await sendBriefEmail(emails, '☀️ Your day', text, html)) delivered = true
    }

    if (delivered) { sent++; await supabase.from('push_alerts').insert({ household_id: hid, alert_key: key }) }
  }
  return sent
}
