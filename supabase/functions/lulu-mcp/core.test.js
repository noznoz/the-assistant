// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { createHandler, sha256Hex, localToISO, isoToLocal, todayIn, addDays, TOOLS, waNumber, buildCalendar, runPushCron } from './core.js'

const KEY = 'lulu_testkey123'
let db, handle, hash

function memoryStore() {
  const rows = new Map() // id -> { hid, collection, data }
  return {
    rows,
    keys: new Map(),
    async household(h) { return this.keys.get(h) || null },
    async list(hid, c) { return [...rows.values()].filter(r => r.hid === hid && r.collection === c && !r.data.deletedAt).map(r => structuredClone(r.data)) },
    async listAll(hid) { return [...rows.values()].filter(r => r.hid === hid && !r.data.deletedAt).map(r => ({ collection: r.collection, data: structuredClone(r.data) })) },
    async get(hid, id) { const r = rows.get(hid + '/' + id); return r ? { collection: r.collection, data: structuredClone(r.data) } : null },
    async put(hid, collection, data) { rows.set(hid + '/' + data.id, { hid, collection, data: structuredClone(data) }) },
    async del(hid, id) { rows.delete(hid + '/' + id) },
    async listHouseholds() { return [...new Set([...rows.values()].map(r => r.hid).concat(['H1']))] },
    async listCollectionAll(c) { return [...rows.values()].filter(r => r.collection === c).map(r => ({ household_id: r.hid, id: r.data.id, data: structuredClone(r.data) })) },
    users: {}, members: [],
    async userFromToken(t) { return this.users[t] || null },
    async isMember(hid, uid) { return this.members.some(m => m.hid === hid && m.uid === uid) },
    async cronStatus() { return { scheduled: true, last_status: 200 } },
  }
}

let nextId = 1
async function rpc(method, params, { key = KEY, path } = {}) {
  const url = path || `https://x.supabase.co/functions/v1/lulu-mcp/${key}`
  const res = await handle(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }) }))
  return { status: res.status, body: res.status === 202 ? null : await res.json() }
}
async function call(name, args) {
  const { body } = await rpc('tools/call', { name, arguments: args })
  return { text: body.result.content[0].text, isError: body.result.isError }
}

beforeEach(async () => {
  db = memoryStore()
  hash = await sha256Hex(KEY)
  db.keys.set(hash, 'H1')
  handle = createHandler({ store: db, tz: 'Asia/Riyadh', currency: 'SAR' })
})

describe('protocol', () => {
  it('initialize negotiates the protocol version and lists tools', async () => {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } })
    expect(init.status).toBe(200)
    expect(init.body.result.protocolVersion).toBe('2025-06-18')
    expect(init.body.result.capabilities.tools).toBeTruthy()
    const unknown = await rpc('initialize', { protocolVersion: '1999-01-01' })
    expect(unknown.body.result.protocolVersion).toBe('2025-06-18')
    const list = await rpc('tools/list', {})
    expect(list.body.result.tools.map(t => t.name)).toContain('add_appointment')
    for (const t of list.body.result.tools) expect(t.inputSchema.type).toBe('object')
  })

  it('notifications get 202, GET gets 405, unknown methods an error', async () => {
    const res = await handle(new Request(`https://x/functions/v1/lulu-mcp/${KEY}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }))
    expect(res.status).toBe(202)
    const get = await handle(new Request(`https://x/functions/v1/lulu-mcp/${KEY}`, { method: 'GET' }))
    expect(get.status).toBe(405)
    const page = await handle(new Request(`https://x/functions/v1/lulu-mcp`, { method: 'GET', headers: { accept: 'text/html,application/xhtml+xml' } }))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('connector is running')
    const sse = await handle(new Request(`https://x/functions/v1/lulu-mcp/${KEY}`, { method: 'GET', headers: { accept: 'text/event-stream' } }))
    expect(sse.status).toBe(405)
    const bad = await rpc('nope/never', {})
    expect(bad.body.error.code).toBe(-32601)
  })

  it('refuses a wrong or missing key, accepts the header form', async () => {
    expect((await rpc('tools/list', {}, { key: 'lulu_wrong' })).status).toBe(401)
    expect((await rpc('tools/list', {}, { path: 'https://x/functions/v1/lulu-mcp' })).status).toBe(401)
    const res = await handle(new Request('https://x/functions/v1/lulu-mcp', { method: 'POST', headers: { 'x-lulu-key': KEY }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }))
    expect(res.status).toBe(200)
  })

  it('a key only reaches its own household', async () => {
    await db.put('OTHER', 'notes', { id: 'n-other', text: 'secret plan', createdAt: '', updatedAt: '' })
    const r = await call('search', { query: 'secret' })
    expect(r.text).toMatch(/Nothing found/)
    const u = await call('update_item', { collection: 'notes', id: 'n-other', changes: { text: 'x' } })
    expect(u.isError).toBe(true)
  })
})

describe('time zone', () => {
  it('converts Riyadh local time to UTC and back', () => {
    expect(localToISO('2026-11-22T09:00', 'Asia/Riyadh')).toBe('2026-11-22T06:00:00.000Z')
    expect(isoToLocal('2026-11-22T06:00:00.000Z', 'Asia/Riyadh')).toBe('2026-11-22 09:00')
    // A zone with daylight saving.
    expect(localToISO('2026-07-01T09:00', 'Europe/London')).toBe('2026-07-01T08:00:00.000Z')
    expect(localToISO('2026-12-01T09:00', 'Europe/London')).toBe('2026-12-01T09:00:00.000Z')
  })
  it('today follows the zone, not UTC', () => {
    // 22:30 UTC on Nov 21 is already Nov 22 in Riyadh.
    expect(todayIn('Asia/Riyadh', new Date('2026-11-21T22:30:00Z'))).toBe('2026-11-22')
  })
})

describe('tools write records the app understands', () => {
  it('add_appointment', async () => {
    await db.put('H1', 'people', { id: 'p1', name: 'Dr. Sara', createdAt: '', updatedAt: '' })
    const r = await call('add_appointment', { title: 'Dentist', date: '2026-11-23', time: '16:00', location: 'Clinic', person: 'sara' })
    expect(r.isError).toBe(false)
    const [a] = await db.list('H1', 'appointments')
    expect(a).toMatchObject({ title: 'Dentist', date: '2026-11-23', time: '16:00', location: 'Clinic', personId: 'p1', deletedAt: null })
    expect(a.id).toMatch(/^x/)
    expect(a.createdAt).toBe(a.updatedAt)
  })

  it('add_reminder stores the same fields as the app', async () => {
    const at = addDays(todayIn('Asia/Riyadh'), 2) + 'T09:30'
    const r = await call('add_reminder', { text: 'Call bank', at })
    expect(r.text).toMatch(/09:30/)
    const [rem] = await db.list('H1', 'reminders')
    expect(rem).toMatchObject({ text: 'Call bank', firedCount: 0, notified: false, done: false, repeat: 'none' })
    expect(rem.times).toEqual([rem.remindAt])
    expect(isoToLocal(rem.remindAt, 'Asia/Riyadh')).toBe(at.replace('T', ' '))
  })

  it('add_expense and add_income validate and default', async () => {
    expect((await call('add_expense', { amount: 0 })).isError).toBe(true)
    expect((await call('add_expense', { amount: 50, date: 'tomorrow' })).isError).toBe(true)
    await call('add_expense', { amount: '1,250.5', category: 'fuel', merchant: 'Aldrees' })
    const [e] = await db.list('H1', 'expenses')
    expect(e).toMatchObject({ amount: 1250.5, currency: 'SAR', category: 'fuel', merchant: 'Aldrees', kind: 'monthly', method: 'credit', date: todayIn('Asia/Riyadh') })
    await call('add_expense', { amount: 10, category: 'not-a-category' })
    expect((await db.list('H1', 'expenses')).find(x => x.amount === 10).category).toBe('other')
    await call('add_income', { amount: 20000, source: 'salary', recurring: true, currency: 'usd' })
    const [i] = await db.list('H1', 'income')
    expect(i).toMatchObject({ amount: 20000, source: 'salary', recurring: true, currency: 'USD' })
  })

  it('add_task, complete_task by title, and repeating tasks continue', async () => {
    await call('add_task', { title: 'Pay rent', due_date: '2026-12-01', repeat: 'monthly', priority: 'high' })
    await call('add_task', { title: 'Buy milk' })
    const done = await call('complete_task', { title: 'pay rent' })
    expect(done.text).toMatch(/Next one is due 2027-01-01|Next one is due 2026-12-31/)
    const tasks = await db.list('H1', 'tasks')
    expect(tasks.filter(t => t.title === 'Pay rent').map(t => t.status).sort()).toEqual(['completed', 'planned'])
    expect(tasks.find(t => t.title === 'Buy milk').status).toBe('new')
  })

  it('complete_task asks when the title is ambiguous', async () => {
    await call('add_task', { title: 'Call Ahmed about car' })
    await call('add_task', { title: 'Call Ahmed about rent' })
    const r = await call('complete_task', { title: 'call ahmed' })
    expect(r.isError).toBe(true)
    expect(r.text).toMatch(/Several open tasks/)
  })

  it('search, update and delete', async () => {
    await call('add_note', { text: 'Umrah packing list: ihram, sandals' })
    const s = await call('search', { query: 'umrah' })
    const id = /\[id (\w+)\]/.exec(s.text)[1]
    const u = await call('update_item', { collection: 'notes', id, changes: { text: 'Umrah list: ihram', id: 'hijack' } })
    expect(u.isError).toBe(false)
    const n = await db.get('H1', id)
    expect(n.data.text).toBe('Umrah list: ihram')
    expect(n.data.id).toBe(id)
    await call('delete_item', { collection: 'notes', id })
    expect((await db.get('H1', id)).data.deletedAt).toBeTruthy()
    expect((await call('search', { query: 'umrah' })).text).toMatch(/Nothing found/)
  })

  it('moving a reminder re-arms it', async () => {
    await call('add_reminder', { text: 'Old', at: '2020-01-01T09:00' })
    const [r] = await db.list('H1', 'reminders')
    expect(r.notified).toBe(true)
    const at = addDays(todayIn('Asia/Riyadh'), 1) + 'T08:00'
    await call('update_item', { collection: 'reminders', id: r.id, changes: { at } })
    const moved = (await db.get('H1', r.id)).data
    expect(moved).toMatchObject({ notified: false, firedCount: 0 })
    expect(moved.at).toBeUndefined()
  })

  it('get_today summarises the day', async () => {
    const today = todayIn('Asia/Riyadh')
    await call('add_task', { title: 'Late thing', due_date: addDays(today, -3) })
    await call('add_appointment', { title: 'Lunch', date: today, time: '13:00' })
    await call('add_expense', { amount: 99 })
    const r = await call('get_today', {})
    expect(r.text).toMatch(new RegExp(`Today is \\w+ ${today}`))
    expect(r.text).toMatch(/Late thing/)
    expect(r.text).toMatch(/13:00 Lunch/)
    expect(r.text).toMatch(/99 SAR/)
  })

  it('generic add_item covers the rest of the app, but not protected parts', async () => {
    const r = await call('add_item', { collection: 'wishlist', fields: { name: 'AirPods', price: 999, id: 'nope' } })
    expect(r.isError).toBe(false)
    const [w] = await db.list('H1', 'wishlist')
    expect(w.name).toBe('AirPods'); expect(w.id).not.toBe('nope')
    expect((await call('add_item', { collection: 'vaults', fields: {} })).isError).toBe(true)
  })

  it('list_items never sends file contents', async () => {
    await db.put('H1', 'documents', { id: 'd1', name: 'Passport', photo: 'data:image/png;base64,AAAA', createdAt: '2026-01-01', updatedAt: '' })
    const r = await call('list_items', { collection: 'documents', full: true })
    expect(r.text).toContain('[file]')
    expect(r.text).not.toContain('base64')
  })

  it('every tool has a description and object schema', () => {
    for (const t of TOOLS) { expect(t.description.length).toBeGreaterThan(10); expect(t.inputSchema.type).toBe('object') }
  })
})

describe('send_whatsapp', () => {
  it('normalises phone numbers to international digits', () => {
    expect(waNumber('0551234567')).toBe('966551234567')
    expect(waNumber('+966 55 123 4567')).toBe('966551234567')
    expect(waNumber('00966551234567')).toBe('966551234567')
    expect(waNumber('551234567')).toBe('966551234567')
    expect(waNumber('+44 7700 900123')).toBe('447700900123')
    expect(waNumber('')).toBe('')
    expect(waNumber('12')).toBe('')
  })

  it('addresses a person from People, with the message encoded', async () => {
    await db.put('H1', 'people', { id: 'p1', name: 'Ahmed Al-Sayed', mobile: '055 123 4567', createdAt: '', updatedAt: '' })
    const r = await call('send_whatsapp', { to: 'ahmed', text: 'مرحبا أحمد، تذكير بالعقد *اليوم*' })
    expect(r.isError).toBe(false)
    const url = r.text.split('\n').pop()
    expect(url.startsWith('https://wa.me/966551234567?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toBe('مرحبا أحمد، تذكير بالعقد *اليوم*')
  })

  it('prefers the WhatsApp number, accepts a raw number, and falls back to the chat picker', async () => {
    await db.put('H1', 'people', { id: 'p2', name: 'Sara', mobile: '0500000000', whatsapp: '+971 50 111 2222', createdAt: '', updatedAt: '' })
    await db.put('H1', 'people', { id: 'p3', name: 'Omar', createdAt: '', updatedAt: '' })
    expect((await call('send_whatsapp', { to: 'Sara', text: 'hi' })).text).toContain('https://wa.me/971501112222?text=hi')
    expect((await call('send_whatsapp', { to: '0559998888', text: 'hi' })).text).toContain('https://wa.me/966559998888?text=hi')
    const omar = await call('send_whatsapp', { to: 'Omar', text: 'hi' })
    expect(omar.text).toContain('no phone number saved')
    expect(omar.text).toContain('https://wa.me/?text=hi')
    expect((await call('send_whatsapp', { text: 'agenda' })).text).toContain('https://wa.me/?text=agenda')
  })

  it('asks when the name is ambiguous or unknown, and needs a message', async () => {
    await db.put('H1', 'people', { id: 'a', name: 'Ahmed Ali', mobile: '0501', createdAt: '', updatedAt: '' })
    await db.put('H1', 'people', { id: 'b', name: 'Ahmed Saleh', mobile: '0502', createdAt: '', updatedAt: '' })
    const amb = await call('send_whatsapp', { to: 'ahmed', text: 'x' })
    expect(amb.isError).toBe(true); expect(amb.text).toMatch(/Several people/)
    const nobody = await call('send_whatsapp', { to: 'Nobody', text: 'x' })
    expect(nobody.isError).toBe(false)
    expect(nobody.text).toContain("isn't saved in People")
    expect(nobody.text).toContain('https://wa.me/?text=x')
    expect((await call('send_whatsapp', { to: 'Ahmed Ali', text: '' })).isError).toBe(true)
  })
})

describe('add_document', () => {
  it('creates a document the app understands, linked to a person', async () => {
    await db.put('H1', 'people', { id: 'p1', name: 'Ahmed Al-Sayed', createdAt: '', updatedAt: '' })
    const r = await call('add_document', { title: 'Iqama — Ahmed', category: 'id', number: '2345678901', expiry: '2027-03-14', person: 'ahmed' })
    expect(r.isError).toBe(false)
    expect(r.text).toMatch(/Add photo/)
    const [d] = await db.list('H1', 'documents')
    expect(d).toMatchObject({ title: 'Iqama — Ahmed', category: 'id', expiry: '2027-03-14', personId: 'p1', number: '2345678901', attachments: [], vaultId: '' })
    expect(d.notes).toContain('No. 2345678901')
  })
  it('validates dates and keeps unknown holders in the notes', async () => {
    expect((await call('add_document', { title: 'x', expiry: '14/03/2027' })).isError).toBe(true)
    await call('add_document', { title: 'Passport', category: 'travel', person: 'Someone New' })
    const d = (await db.list('H1', 'documents')).find(x => x.title === 'Passport')
    expect(d.personId).toBeUndefined()
    expect(d.notes).toContain('Holder: Someone New')
    await call('add_document', { title: 'Odd', category: 'nonsense' })
    expect((await db.list('H1', 'documents')).find(x => x.title === 'Odd').category).toBe('other')
  })
})

describe('reminder status', () => {
  it('sets in progress, done and back, keeping done in step', async () => {
    await call('add_reminder', { text: 'Send tickets', at: addDays(todayIn('Asia/Riyadh'), 1) + 'T20:00' })
    const [r] = await db.list('H1', 'reminders')
    expect(r).toMatchObject({ status: 'todo', done: false })
    await call('update_item', { collection: 'reminders', id: r.id, changes: { status: 'in_progress' } })
    expect((await db.get('H1', r.id)).data).toMatchObject({ status: 'in_progress', done: false })
    expect((await call('list_items', { collection: 'reminders' })).text).toContain('in progress')
    await call('update_item', { collection: 'reminders', id: r.id, changes: { done: true } })
    expect((await db.get('H1', r.id)).data).toMatchObject({ status: 'done', done: true })
    await call('update_item', { collection: 'reminders', id: r.id, changes: { status: 'todo' } })
    expect((await db.get('H1', r.id)).data).toMatchObject({ status: 'todo', done: false, doneAt: null })
    expect((await call('update_item', { collection: 'reminders', id: r.id, changes: { status: 'maybe' } })).isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('Apple Calendar feed', () => {
  const tz = 'Asia/Riyadh'
  it('builds a valid feed with stable ids, local times and all-day items', () => {
    const today = todayIn(tz)
    const { text, count } = buildCalendar({
      appointments: [{ id: 'a1', title: 'Dentist, Dr. Sara', date: addDays(today, 2), time: '16:30', location: 'Clinic' }, { id: 'a2', title: 'Family day', date: addDays(today, 3) }],
      tasks: [{ id: 't1', title: 'Renew iqama', dueDate: addDays(today, 5), status: 'planned' }, { id: 't2', title: 'Done thing', dueDate: today, status: 'completed' }],
      reminders: [{ id: 'r1', text: 'Call bank', times: [localToISO(`${addDays(today, 1)}T09:00`, tz)], done: false }],
      documents: [{ id: 'd1', title: 'Passport', expiry: addDays(today, 60) }],
    }, tz)
    expect(count).toBe(5) // the completed task is left out
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text.trim().endsWith('END:VCALENDAR')).toBe(true)
    expect(text).toContain('UID:appt-a1@the-assistant')
    expect(text).toContain('SUMMARY:Dentist\\, Dr. Sara') // commas escaped
    const d = addDays(today, 2).replace(/-/g, '')
    expect(text).toContain(`DTSTART:${d}T133000Z`) // 16:30 Riyadh = 13:30 UTC
    expect(text).toContain(`DTSTART;VALUE=DATE:${addDays(today, 3).replace(/-/g, '')}`)
    expect(text).toContain('SUMMARY:📄 Passport expires')
    expect(text).not.toContain('Done thing')
    expect(text.split('\r\n').every(l => l.length <= 75)).toBe(true) // folded
  })

  it('is served by a read-only calendar link, which cannot be used as a Claude link', async () => {
    const CAL = 'lulucal_testcalendarkey'
    db.keys.set(await sha256Hex(CAL), 'H1')
    await call('add_appointment', { title: 'Lunch', date: addDays(todayIn('Asia/Riyadh'), 1), time: '13:00' })
    const res = await handle(new Request(`https://x/functions/v1/lulu-mcp/${CAL}/calendar.ics`, { method: 'GET' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    expect(await res.text()).toContain('SUMMARY:Lunch')
    // The calendar key can't drive Claude's tools…
    const mcp = await handle(new Request(`https://x/functions/v1/lulu-mcp/${CAL}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }))
    expect(mcp.status).toBe(401)
    // …and a Claude key or a removed key doesn't open the feed.
    expect((await handle(new Request(`https://x/functions/v1/lulu-mcp/${KEY}/calendar.ics`, { method: 'GET' }))).status).not.toBe(200)
    expect((await handle(new Request(`https://x/functions/v1/lulu-mcp/lulucal_removed/calendar.ics`, { method: 'GET' }))).status).toBe(404)
  })
})

describe('background push', () => {
  const tz = 'Asia/Riyadh'
  let sent, dead, push
  beforeEach(() => {
    sent = []; dead = new Set()
    push = { publicKey: 'PUBKEY', async send(sub, payload) { if (dead.has(sub.endpoint)) { const e = new Error('gone'); e.statusCode = 410; throw e } sent.push({ to: sub.endpoint, ...JSON.parse(payload) }) } }
    handle = createHandler({ store: db, push, tz })
    db.users.tok = { id: 'u1' }; db.members = [{ hid: 'H1', uid: 'u1' }]
  })
  const sub = (id, endpoint) => db.put('H1', '_pushsub', { id, endpoint, subscription: { endpoint }, createdAt: '', updatedAt: '', deletedAt: null })
  const post = async (path, body, token) => {
    const r = await handle(new Request(`https://x/functions/v1/lulu-mcp/${path}`, { method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {}, body: JSON.stringify(body) }))
    return { status: r.status, json: await r.json() }
  }

  it('app requests: key is public; status and test need a signed-in member', async () => {
    await sub('push:a', 'https://push/phone')
    expect((await post('push', { action: 'key' })).json.publicKey).toBe('PUBKEY')
    expect((await post('push', { action: 'status', household_id: 'H1' })).status).toBe(403)
    expect((await post('push', { action: 'status', household_id: 'H2' }, 'tok')).status).toBe(403)
    const st = await post('push', { action: 'status', household_id: 'H1', endpoint: 'https://push/phone' }, 'tok')
    expect(st.json).toMatchObject({ ok: true, registered: true, subscriptions: 1, publicKey: 'PUBKEY' })
    const t = await post('push', { action: 'test', household_id: 'H1' }, 'tok')
    expect(t.json.sent).toBe(1)
  })

  it('every minute: a due reminder is sent once, marked fired, and the phone will take the change', async () => {
    await sub('push:a', 'https://push/phone')
    const past = new Date(Date.now() - 60000).toISOString()
    await db.put('H1', 'reminders', { id: 'r1', text: 'Call bank', times: [past], remindAt: past, firedCount: 0, done: false, updatedAt: '2026-01-01T00:00:00.000Z' })
    const night = new Date('2026-11-23T00:30:00Z') // 03:30 Riyadh: reminders yes, due-today alerts no
    await runPushCron({ store: db, push, tz, now: night })
    // reminder time is "1 minute before real now", so use real now for it:
    await runPushCron({ store: db, push, tz, now: new Date() })
    expect(sent.filter(x => x.body === 'Call bank')).toHaveLength(1)
    const r = (await db.get('H1', 'r1')).data
    expect(r).toMatchObject({ firedCount: 1, notified: true })
    expect(r.updatedAt > '2026-01-01').toBe(true)
    await runPushCron({ store: db, push, tz, now: new Date() })
    expect(sent.filter(x => x.body === 'Call bank')).toHaveLength(1) // not again
    expect((await db.list('H1', '_pushcfg'))[0].lastRunAt).toBeTruthy() // heartbeat
  })

  it('due-today alerts only in the daytime, once each; morning brief once; dead phones removed', async () => {
    await sub('push:a', 'https://push/phone'); await sub('push:b', 'https://push/old'); dead.add('https://push/old')
    const day = '2026-11-23'
    await db.put('H1', 'appointments', { id: 'a1', title: 'Dentist', date: day, time: '16:00' })
    await runPushCron({ store: db, push, tz, now: new Date('2026-11-23T00:30:00Z') }) // 03:30 local
    expect(sent.some(x => x.title === 'Appointment today')).toBe(false)
    await runPushCron({ store: db, push, tz, now: new Date('2026-11-23T05:00:00Z') }) // 08:00 local
    expect(sent.filter(x => x.title === 'Appointment today')).toHaveLength(1)
    expect(sent.filter(x => x.title === '☀️ Good morning')).toHaveLength(1)
    await runPushCron({ store: db, push, tz, now: new Date('2026-11-23T05:01:00Z') })
    expect(sent.filter(x => x.title === 'Appointment today')).toHaveLength(1)
    expect(sent.filter(x => x.title === '☀️ Good morning')).toHaveLength(1)
    expect((await db.list('H1', '_pushsub')).map(s => s.endpoint)).toEqual(['https://push/phone'])
  })

  it('the schedule route runs it', async () => {
    const r = await post('cron', {})
    expect(r.status).toBe(200)
    expect(r.json).toHaveProperty('households')
  })
})
