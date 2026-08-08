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

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys not configured' }, 500)
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const nowIso = new Date().toISOString()

  const { data: recs, error } = await supabase
    .from('records').select('household_id,id,data').eq('collection', 'reminders')
  if (error) return json({ error: error.message }, 500)

  const due = (recs ?? []).filter((r: any) => {
    const d = r.data || {}
    return d.remindAt && d.remindAt <= nowIso && !d.notified && !d.done && !d.deletedAt
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
      await supabase.from('records')
        .update({ data: { ...(r as any).data, notified: true, notifiedAt: nowIso }, updated_at: nowIso })
        .eq('household_id', (r as any).household_id).eq('id', (r as any).id)
    }
  }
  return json({ due: due.length, sent })
})
