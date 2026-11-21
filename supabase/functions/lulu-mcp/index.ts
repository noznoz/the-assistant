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
// The link carries a secret key. Only its SHA-256 hash is stored (table
// assistant_keys), and it maps to exactly one household. The function uses
// the service role to read/write that household's rows in `records`, in the
// same shape the app syncs, so changes appear on the phone at its next sync.
//
// Secrets (Supabase provides the first two automatically):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   LULU_TZ        optional, default Asia/Riyadh
//   LULU_CURRENCY  optional, default SAR
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
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
    const { data, error } = await supabase.from('records').select('collection,data').eq('household_id', hid)
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
}

Deno.serve(createHandler({
  store,
  tz: Deno.env.get('LULU_TZ') || 'Asia/Riyadh',
  currency: Deno.env.get('LULU_CURRENCY') || 'SAR',
}))
