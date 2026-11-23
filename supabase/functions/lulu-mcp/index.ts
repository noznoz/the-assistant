// ============================================================================
// lulu-mcp — Supabase Edge Function (Deno): an MCP server so Claude can read
// and change The Assistant's data (tasks, calendar, reminders, notes, money,
// people, and the rest) — including by voice from the Claude app.
//
// Setup: docs/CLAUDE-CONNECTOR.md. In short: run the SQL there once, deploy
//   supabase functions deploy lulu-mcp --no-verify-jwt
// then in the app: More → Settings → Cloud & family → Connect Claude, and paste the link
// it gives you into Claude → Settings → Connectors → Add custom connector.
//
// Also: a read-only Apple Calendar feed (…/lulu-mcp/<lulucal_ key>/calendar.ics)
// and background push (…/lulu-mcp/push for the app, …/lulu-mcp/cron every
// minute) — see core.js. No extra tables: everything lives in `records`.
//
// The link carries a secret key. Only its SHA-256 hash is stored (table
// assistant_keys), and it maps to exactly one household. The function uses
// the service role to read/write that household's rows in `records`, in the
// same shape the app syncs, so changes appear on the phone at its next sync.
//
// Secrets (Supabase provides the first two automatically):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   LULU_TZ        optional, default Asia/Riyadh
//   LULU_CURRENCY  optional, default SAR
//   LULU_COUNTRY_CODE  optional, default 966 (for local numbers like 05…)
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { createHash, createECDH } from 'node:crypto'
import { createHandler } from './core.js'

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false },
})

const live = (rows: any[] | null) => (rows ?? []).filter((r) => r && r.data && !r.data.deletedAt)

const store = {
  async household(keyHash: string) {
    const { data } = await supabase.from('assistant_keys').select('household_id').eq('key_hash', keyHash).maybeSingle()
    if (!data) return null
    // Best effort: show "last used" in the app.
    supabase.from('assistant_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash).then(() => {})
    return data.household_id as string
  },
  async list(hid: string, collection: string) {
    const { data, error } = await supabase.from('records').select('data').eq('household_id', hid).eq('collection', collection)
    if (error) throw new Error(error.message)
    return live(data).map((r: any) => r.data)
  },
  async listAll(hid: string) {
    // File pieces, settings and push bookkeeping aren't searchable items.
    const { data, error } = await supabase.from('records').select('collection,data').eq('household_id', hid).not('collection', 'in', '(_files,_settings,_pushsub,_pushalert,_pushcfg)')
    if (error) throw new Error(error.message)
    return live(data).map((r: any) => ({ collection: r.collection, data: r.data }))
  },
  async get(hid: string, id: string) {
    const { data, error } = await supabase.from('records').select('collection,data').eq('household_id', hid).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? { collection: data.collection, data: data.data } : null
  },
  async put(hid: string, collection: string, record: any) {
    const { error } = await supabase.from('records').upsert({
      household_id: hid, id: record.id, collection, data: record, updated_at: record.updatedAt,
    }, { onConflict: 'household_id,id' })
    if (error) throw new Error(error.message)
  },
  async del(hid: string, id: string) {
    await supabase.from('records').delete().eq('household_id', hid).eq('id', id)
  },
  // Background push (every minute): all households and all device subscriptions.
  async listHouseholds() {
    const { data } = await supabase.from('households').select('id')
    return (data ?? []).map((h: any) => h.id)
  },
  async listCollectionAll(collection: string) {
    const { data } = await supabase.from('records').select('household_id,id,data').eq('collection', collection)
    return data ?? []
  },
  // The app's push requests come with the signed-in user's token.
  async userFromToken(token: string) {
    const { data, error } = await supabase.auth.getUser(token)
    return error || !data?.user ? null : data.user
  },
  async isMember(hid: string, uid: string) {
    const { data } = await supabase.from('household_members').select('user_id').eq('household_id', hid).eq('user_id', uid).maybeSingle()
    return !!data
  },
  async cronStatus() {
    const { data, error } = await supabase.rpc('push_cron_status')
    return error ? null : data
  },
}

// Push keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets if set; otherwise a
// stable pair derived from this project's service-role secret, so nothing has
// to be generated or stored, and it never changes between deploys.
function vapidKeys() {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (pub && priv) return { publicKey: pub, privateKey: priv }
  for (let i = 0; i < 8; i++) {
    const seed = createHash('sha256').update(`lulu-vapid:${i}:` + (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')).digest()
    try {
      const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(seed)
      return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: seed.toString('base64url') }
    } catch { /* out of range (astronomically rare) — next seed */ }
  }
  throw new Error('could not derive push keys')
}
const VAPID = vapidKeys()
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
// Apple requires the VAPID subject to be a mailto: or https: address.
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || (SUPABASE_URL.startsWith('https://') ? SUPABASE_URL : 'mailto:push@example.com'), VAPID.publicKey, VAPID.privateKey)
const push = {
  publicKey: VAPID.publicKey,
  async send(subscription: any, payload: string) { await webpush.sendNotification(subscription, payload, { TTL: 3600 }) },
}

Deno.serve(createHandler({
  store,
  push,
  tz: Deno.env.get('LULU_TZ') || 'Asia/Riyadh',
  currency: Deno.env.get('LULU_CURRENCY') || 'SAR',
  countryCode: Deno.env.get('LULU_COUNTRY_CODE') || '966',
}))
