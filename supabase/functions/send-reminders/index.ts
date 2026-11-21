// ============================================================================
// send-reminders — Supabase Edge Function (Deno).
//
// Delivers reminders and "due today" alerts as Web Push, so they arrive even
// when the app is closed, plus a morning brief. Runs every minute from a
// pg_cron schedule. Setup: docs/PUSH.md (paste-deploy from the dashboard, turn
// "Verify JWT" off, run the push setup SQL the app shows you).
//
// Requests it answers (all POST, JSON):
//   {}                                  the every-minute run (from pg_cron)
//   { action: 'key' }                   the public push key, for the app
//   { action: 'status', household_id, endpoint }   checklist for the app *
//   { test: true, household_id }        send a test push to the household *
//   * needs the signed-in user's token; they must belong to that household.
//
// Push keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets if set; otherwise a
// pair is generated on first use and kept in public.push_config (readable by
// the service role only), so no key ever has to be made by hand.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (automatic). Optional:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, LULU_TZ (default
// Asia/Riyadh), RESEND_API_KEY + BRIEF_FROM (morning brief by email).
// ============================================================================
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// Apple requires the VAPID subject to be a mailto: or https: address.
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || (SUPABASE_URL.startsWith('https://') ? SUPABASE_URL : 'mailto:push@example.com')
const TZ = Deno.env.get('LULU_TZ') || 'Asia/Riyadh'

// Allow the app (a different origin) to call this.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } })
}

// The user's local date and minutes-past-midnight.
function localParts(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, mins: Number(p.hour) * 60 + Number(p.minute) }
}
const localTime = (iso: string) => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) } catch { return '' }
}

class SetupError extends Error {}

// The push key pair: from secrets, else from push_config (made on first use).
async function vapidKeys(supabase: any) {
  const envPub = Deno.env.get('VAPID_PUBLIC_KEY'), envPriv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv, source: 'secrets' }
  const read = () => supabase.from('push_config').select('public_key,private_key').eq('id', 1).maybeSingle()
  let { data, error } = await read()
  if (error) throw new SetupError('push_config')
  if (!data || !data.public_key || !data.private_key) {
    const k = webpush.generateVAPIDKeys()
    if (!data) await supabase.from('push_config').upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
    else await supabase.from('push_config').update({ public_key: k.publicKey, private_key: k.privateKey }).eq('id', 1).is('public_key', null)
    ;({ data } = await read()) // whoever won a race, use what's stored
  }
  if (!data || !data.public_key || !data.private_key) throw new SetupError('push_config')
  return { publicKey: data.public_key as string, privateKey: data.private_key as string, source: 'generated' }
}

// The signed-in caller, if they belong to household `hid`.
async function memberCaller(req: Request, supabase: any, hid: string) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || !hid) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data || !data.user) return null
  const { data: m } = await supabase.from('household_members').select('user_id').eq('household_id', hid).eq('user_id', data.user.id).maybeSingle()
  return m ? data.user : null
}

// Send one payload to a household's devices; prune dead subscriptions.
async function pushToHousehold(supabase: any, hid: string, payload: string, subsIn?: any[]) {
  let subs = subsIn
  if (!subs) { const r = await supabase.from('push_subscriptions').select('endpoint,subscription').eq('household_id', hid); subs = r.data ?? [] }
  let delivered = 0
  for (const s of subs ?? []) {
    try { await webpush.sendNotification((s as any).subscription, payload, { TTL: 3600 }); delivered++ }
    catch (e: any) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await supabase.from('push_subscriptions').delete().eq('endpoint', (s as any).endpoint)
    }
  }
  return delivered
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  const nowIso = new Date().toISOString()
  let body: any = {}
  try { body = await req.json() } catch { /* the schedule may send no body */ }
  body = body || {}

  let keys
  try { keys = await vapidKeys(supabase) }
  catch (e) { return json({ error: 'setup-sql', detail: 'Run the push setup SQL (table push_config is missing).' }, e instanceof SetupError ? 200 : 500) }
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey)

  // The public key is public: the app subscribes with it.
  if (body.action === 'key') return json({ publicKey: keys.publicKey })

  // Checklist for the app: is everything after the phone in place?
  if (body.action === 'status') {
    const hid = body.household_id
    if (!(await memberCaller(req, supabase, hid))) return json({ error: 'not-allowed' }, 403)
    const subsR = await supabase.from('push_subscriptions').select('endpoint').eq('household_id', hid)
    const cfg = await supabase.from('push_config').select('last_run_at').eq('id', 1).maybeSingle()
    let cron: any = null
    try { const r = await supabase.rpc('push_cron_status'); cron = r.error ? null : r.data } catch { cron = null }
    return json({
      ok: true, publicKey: keys.publicKey, keysFrom: keys.source,
      tables: !subsR.error,
      subscriptions: (subsR.data ?? []).length,
      registered: !!(body.endpoint && (subsR.data ?? []).some((s: any) => s.endpoint === body.endpoint)),
      lastRun: cfg.data ? cfg.data.last_run_at : null,
      cron, now: nowIso,
    })
  }

  // Test push: only for members of that household.
  if (body.test) {
    const hid = body.household_id
    if (!(await memberCaller(req, supabase, hid))) return json({ error: 'not-allowed' }, 403)
    const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,subscription').eq('household_id', hid)
    const payload = JSON.stringify({ title: 'Test push ✅', body: 'Background reminders are working.', tag: 'lulu-test', url: '#/reminders' })
    const sent = await pushToHousehold(supabase, hid, payload, subs ?? [])
    return json({ test: true, subscriptions: (subs ?? []).length, sent })
  }

  // ---- The every-minute run ----
  // Heartbeat first, so the app can show "last run: a minute ago".
  await supabase.from('push_config').upsert({ id: 1, last_run_at: nowIso }, { onConflict: 'id' })

  const { data: recs, error } = await supabase
    .from('records').select('household_id,id,data').eq('collection', 'reminders')
  if (error) return json({ error: error.message }, 500)

  // A reminder carries up to 3 alert times (`times`) and `firedCount` (how many
  // of the earliest have alerted). Legacy records use `remindAt` + `notified`.
  const normalize = (d: any) => {
    const times = (Array.isArray(d.times) && d.times.length)
      ? [...new Set(d.times.filter(Boolean))].sort() as string[]
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
    const d = (r as any).data
    const payload = JSON.stringify({ title: 'Reminder', body: d.text || '', tag: 'reminder-' + (r as any).id, url: '#/reminders' })
    const delivered = await pushToHousehold(supabase, (r as any).household_id, payload)
    if (!delivered) continue
    sent++
    const { times, passed } = normalize(d)
    const repeat = d.repeat
    // `updatedAt` must move too: the app keeps whichever copy has the newer
    // updatedAt, so without it the phone would ignore this change and alert again.
    let next
    if (passed >= times.length && repeat && repeat !== 'none') {
      const nt = nextRepeatTimes(times, repeat) // fully fired + repeating → next occurrence
      next = { ...d, times: nt, firedCount: 0, remindAt: nt[0], notified: false, notifiedAt: nowIso, updatedAt: nowIso }
    } else {
      const remindAt = times[Math.min(passed, times.length - 1)] || null
      next = { ...d, firedCount: passed, remindAt, notified: passed >= times.length, notifiedAt: nowIso, updatedAt: nowIso }
    }
    await supabase.from('records').update({ data: next, updated_at: nowIso })
      .eq('household_id', (r as any).household_id).eq('id', (r as any).id)
  }

  // Background alerts for any other dated item that is due today or overdue —
  // tasks, appointments, subscriptions, expiries, birthdays. Daytime only (no
  // alerts in the night), de-duplicated in push_alerts so each fires once.
  let alerts = 0
  try { alerts = await runDatedAlerts(supabase) } catch (_e) { alerts = -1 /* push_alerts not set up */ }

  let brief = 0
  try { brief = await runDailyBrief(supabase) } catch (_e) { brief = -1 }

  return json({ due: due.length, sent, alerts, brief })
})

// ---- Dated-item background alerts --------------------------------------------
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
  const { date: today, mins } = localParts()
  if (mins < 7 * 60 || mins >= 22 * 60) return 0 // daytime only (07:00–22:00 local)
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
      if (await pushToHousehold(supabase, hid, payload, subs)) { alerts++; await supabase.from('push_alerts').insert({ household_id: hid, alert_key: it.key }) }
    }
  }
  return alerts
}

// ---- Daily "start my day" brief -------------------------------------------
// Once per household per morning, at/after 07:30 local time (LULU_TZ), push a
// concise brief. Windowed to 07:30–10:00 so a late run doesn't deliver it
// mid-day; de-duplicated per day via push_alerts.

function briefBody(recs: any[], today: string) {
  const of = (col: string) => recs.filter(r => r.collection === col && r.data && !r.data.deletedAt).map(r => r.data)
  const open = of('tasks').filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter((t: any) => dateOnly(t.dueDate) === today)
  const overdue = open.filter((t: any) => { const d = dateOnly(t.dueDate); return d && d < today })
  const appts = of('appointments').filter((a: any) => dateOnly(a.date) === today).sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''))
  const rem = of('reminders').filter((r: any) => !r.done && r.remindAt && (dateOnly(r.remindAt) || '') <= today)
  const parts: string[] = []
  if (dueToday.length) parts.push(`${dueToday.length} due today`)
  if (overdue.length) parts.push(`${overdue.length} overdue`)
  if (appts.length) parts.push(`${appts[0].time ? appts[0].time + ' ' : ''}${appts[0].title}${appts.length > 1 ? ` +${appts.length - 1}` : ''}`)
  if (rem.length) parts.push(`${rem.length} reminder${rem.length > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : 'Your day is clear.'
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

// Fuller brief for the email body (the push stays concise). Returns text + HTML.
function emailBrief(list: any[], date: string) {
  const of = (col: string) => list.filter(r => r.collection === col && r.data && !r.data.deletedAt).map(r => r.data)
  const open = of('tasks').filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter((t: any) => dateOnly(t.dueDate) === date)
  const overdue = open.filter((t: any) => { const d = dateOnly(t.dueDate); return d && d < date })
  const waiting = open.filter((t: any) => t.status === 'waiting_me')
  const appts = of('appointments').filter((a: any) => dateOnly(a.date) === date).sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''))
  const rem = of('reminders').filter((r: any) => !r.done && r.remindAt && (dateOnly(r.remindAt) || '') <= date).sort((a: any, b: any) => String(a.remindAt).localeCompare(String(b.remindAt)))

  const L: string[] = ['Good morning.', '', 'AGENDA']
  appts.forEach((a: any) => L.push(`  ${a.time || '—'}  ${a.title || 'Appointment'}`))
  rem.forEach((r: any) => L.push(`  ${localTime(r.remindAt)}  (reminder) ${r.text || ''}`))
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
  rem.forEach((r: any) => rows.push(`<tr><td style="padding:3px 12px 3px 0;color:#9a7b3a;white-space:nowrap">${esc(localTime(r.remindAt))}</td><td style="padding:3px 0">🔔 ${esc(r.text || '')}</td></tr>`))
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
  const { date, mins } = localParts()
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
    const payload = JSON.stringify({ title: '☀️ Good morning', body: briefBody(list, date), tag: 'daily-brief' })
    if (await pushToHousehold(supabase, hid, payload)) delivered = true

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
