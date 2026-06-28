import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webPush from 'npm:web-push'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webPush.setVapidDetails('mailto:admin@roadheaven.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const db = createClient(SUPABASE_URL, SERVICE_KEY)

serve(async (req) => {
  try {
    const body = await req.json()
    // Supabase database webhook sends { type, table, record, old_record }
    const record = body.record ?? body
    if (!record?.recipient_name) return new Response('ok')

    const { recipient_name, data } = record
    // Don't push for sent copies stored under the sender
    if (data?.type === 'sent_message') return new Response('ok')

    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('subscription')
      .eq('rider_name', recipient_name)

    if (error || !subs?.length) return new Response('ok')

    const title = data?.type === 'message'
      ? `📩 Message from ${data.from}`
      : '🏍️ Road Heaven'
    const notifBody = (data?.text || 'You have a new notification').slice(0, 120)
    const payload = JSON.stringify({ title, body: notifBody, tag: `rh-${record.id}` })

    await Promise.allSettled(
      subs.map(({ subscription }) => webPush.sendNotification(subscription, payload))
    )

    return new Response('ok')
  } catch (err) {
    console.error('send-push error:', err)
    return new Response('error', { status: 500 })
  }
})
