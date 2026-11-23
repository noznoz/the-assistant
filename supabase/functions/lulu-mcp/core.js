// ============================================================================
// lulu-mcp — the logic of the MCP server that lets Claude use The Assistant.
//
// Plain JavaScript with no imports, so the same file runs inside the Supabase
// Edge Function (Deno) and in the unit tests (Node). index.ts wires it to the
// real database; tests wire it to an in-memory store.
//
// Transport: MCP "Streamable HTTP" in its simplest form — every request is a
// JSON-RPC POST answered with one JSON response (no server-sent events).
//
// Records are written in exactly the shape the app's own editors produce
// (src/lulu/store/db.js + the feature editors), so they appear in the app the
// next time it syncs, as if they had been added on the phone.
// ============================================================================

export const SERVER_INFO = { name: 'the-assistant', title: 'The Assistant', version: '1.0.0' }
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

// Every collection the app stores (mirror of COLLECTIONS in store/db.js).
export const COLLECTIONS = [
  'tasks', 'inbox', 'vehicles', 'services', 'accessories',
  'expenses', 'income', 'investments', 'accounts', 'networth', 'liabilities',
  'properties', 'valuables', 'memberships', 'projects', 'subscriptions', 'rewards',
  'people', 'groups', 'documents', 'trips', 'notes', 'notifications', 'wishlist', 'goals', 'appointments',
  'staff', 'propertylog', 'itinerary', 'departments', 'members', 'meetings', 'spiritual', 'giving',
  'vaults', 'reminders',
]
// Collections whose records hold photos/files or account structure Claude
// shouldn't rewrite wholesale. Reading is fine; generic writes are refused.
const NO_GENERIC_WRITE = new Set(['vaults', 'notifications', 'members', 'departments'])

const EXPENSE_CATEGORIES = ['household', 'dining', 'groceries', 'shopping', 'travel', 'hotels', 'flights', 'transport', 'fuel', 'vehicle_maint', 'moto_acc', 'boat', 'marina', 'insurance', 'work', 'family', 'education', 'entertainment', 'health', 'subscriptions', 'utilities', 'gifts', 'charity', 'other']
const PAYMENT_METHODS = ['cash', 'debit', 'credit', 'transfer', 'amex', 'apple_pay', 'wallet', 'company']
const INCOME_SOURCES = ['salary', 'bonus', 'dividend', 'rental', 'business', 'stocks', 'fund', 'realestate', 'crypto', 'savings', 'other']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const TASK_STATUSES = ['inbox', 'new', 'planned', 'in_progress', 'waiting_someone', 'waiting_me', 'on_hold', 'completed', 'cancelled']
const DOC_CATEGORIES = ['id', 'work', 'vehicle_reg', 'insurance', 'invoice', 'warranty', 'travel', 'financial', 'contract', 'medical', 'property', 'education', 'personal', 'other']
const APPT_TYPES = ['doctor', 'dentist', 'meeting', 'personal', 'family', 'car', 'government', 'other']

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
export function uid() {
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s)
const str = (v) => (v == null ? '' : String(v).trim())
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : NaN }

// Today's date (YYYY-MM-DD) in the user's time zone.
export function todayIn(tz, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// The UTC offset (minutes) of `tz` at instant `ms`.
function offsetMinutes(tz, ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asUTC - ms) / 60000)
}
// "2026-11-22T09:00" in the user's zone → an ISO instant ("2026-11-22T06:00:00.000Z" for Riyadh).
export function localToISO(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(str(local))
  if (!m) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let ms = guess - offsetMinutes(tz, guess) * 60000
  ms = guess - offsetMinutes(tz, ms) * 60000 // second pass settles DST edges
  return new Date(ms).toISOString()
}
// An ISO instant → "YYYY-MM-DD HH:MM" in the user's zone (for readable replies).
export function isoToLocal(iso, tz) {
  if (!iso) return ''
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}
function nextDate(dateStr, freq) {
  if (!isDate(dateStr)) return null
  const d = new Date(dateStr + 'T00:00:00Z')
  if (freq === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else if (freq === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (freq === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else if (freq === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else return null
  return d.toISOString().slice(0, 10)
}

// A phone number as WhatsApp wants it: international digits, no + or 00.
// Local numbers get the home country code (Saudi: 05XXXXXXXX → 9665XXXXXXXX).
export function waNumber(raw, cc = '966') {
  let d = String(raw || '').replace(/[^0-9]/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = cc + d.slice(1)
  else if (d.length <= 9) d = cc + d
  return d.length >= 8 ? d : ''
}

// The one human-readable line used for a record in lists and search results.
export function describe(collection, r, tz) {
  const bits = []
  const title = r.title || r.text || r.name || r.item || r.merchant || r.nickname || r.source || r.label || ''
  bits.push(String(title).split('\n')[0].slice(0, 120) || '(untitled)')
  if (collection === 'tasks') {
    if (r.dueDate) bits.push(`due ${r.dueDate}${r.dueTime ? ' ' + r.dueTime : ''}`)
    if (r.priority) bits.push(r.priority)
    if (r.status) bits.push(r.status)
    if (r.assignedTo) bits.push(`for ${r.assignedTo}`)
  } else if (collection === 'appointments') {
    bits.push(`${r.date || ''}${r.time ? ' ' + r.time : ''}`.trim())
    if (r.location) bits.push(r.location)
  } else if (collection === 'reminders') {
    if (r.remindAt) bits.push(`at ${isoToLocal(r.remindAt, tz)}`)
    bits.push(r.done ? 'done' : r.status === 'in_progress' ? 'in progress' : 'to do')
  } else if (collection === 'expenses' || collection === 'income' || collection === 'giving') {
    if (r.amount != null) bits.push(`${r.amount} ${r.currency || ''}`.trim())
    if (r.category) bits.push(r.category)
    if (r.date) bits.push(r.date)
  } else if (r.date) bits.push(r.date)
  return bits.filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------------------
// Tool definitions (what Claude sees)
// ---------------------------------------------------------------------------
const dateProp = (d) => ({ type: 'string', description: `${d} As YYYY-MM-DD. Resolve words like "tomorrow" or "next Sunday" with get_today first.` })

export const TOOLS = [
  {
    name: 'get_today',
    title: 'Today at a glance',
    description: "Today's date and weekday in the user's time zone, plus what's on: overdue and today's tasks, today's appointments, reminders still to come today, and this month's spending. Call this first whenever the user says a relative date (today, tomorrow, next week) or asks what's on.",
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'search',
    title: 'Search everything',
    description: 'Find records anywhere in the app by words in their title, text, name, merchant, notes or location. Returns each match with its collection and id, which update_item, delete_item and complete_task need.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for (any language).' },
        collection: { type: 'string', enum: COLLECTIONS, description: 'Optional: only search this part of the app.' },
        limit: { type: 'number', description: 'Most results to return (default 15).' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_items',
    title: 'List items',
    description: `List records in one part of the app, newest first (tasks: open ones by due date; appointments: upcoming by date). Collections: ${COLLECTIONS.join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', enum: COLLECTIONS },
        limit: { type: 'number', description: 'Default 20, max 100.' },
        include_done: { type: 'boolean', description: 'Tasks/reminders: include completed ones. Appointments: include past ones.' },
        full: { type: 'boolean', description: 'Return every field of each record instead of a one-line summary.' },
      },
      required: ['collection'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_task',
    title: 'Add a task',
    description: 'Add a to-do to the Plan.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due_date: dateProp('Optional due date.'),
        due_time: { type: 'string', description: 'Optional, 24-hour HH:MM.' },
        priority: { type: 'string', enum: PRIORITIES, description: 'Default medium.' },
        classification: { type: 'string', enum: ['personal', 'work'], description: 'Default personal.' },
        assigned_to: { type: 'string', description: "Optional: the person's name, if someone else is doing it." },
        notes: { type: 'string' },
        repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    title: 'Mark a task done',
    description: 'Mark an open task as done. Pass its id (from search or list_items), or its title. A repeating task gets its next occurrence created, as in the app.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, title: { type: 'string', description: 'Used when no id is given; matched against open tasks.' } },
    },
  },
  {
    name: 'add_appointment',
    title: 'Add an appointment',
    description: 'Add an appointment to the calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: dateProp('The day.'),
        time: { type: 'string', description: 'Optional, 24-hour HH:MM.' },
        location: { type: 'string' },
        type: { type: 'string', enum: APPT_TYPES, description: 'Default other.' },
        person: { type: 'string', description: 'Optional: who it is with — matched to People by name.' },
        note: { type: 'string' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'add_reminder',
    title: 'Set a reminder',
    description: "Set a reminder that alerts the user's phone at a time.",
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to remind about.' },
        at: { type: 'string', description: "When, in the user's local time: YYYY-MM-DDTHH:MM (24-hour)." },
        repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'], description: 'Default none.' },
      },
      required: ['text', 'at'],
    },
  },
  {
    name: 'add_note',
    title: 'Save a note',
    description: 'Save a note to the Notes / Inbox.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'add_expense',
    title: 'Log an expense',
    description: 'Log money spent.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', description: 'ISO code. Default the user\'s currency.' },
        category: { type: 'string', enum: EXPENSE_CATEGORIES, description: 'Default other. Petrol is fuel.' },
        merchant: { type: 'string', description: 'Where (shop, restaurant, station).' },
        item: { type: 'string', description: 'What was bought, if said.' },
        date: dateProp('Default today.'),
        method: { type: 'string', enum: PAYMENT_METHODS, description: 'How it was paid. Default credit.' },
        kind: { type: 'string', enum: ['monthly', 'special'], description: 'special = a one-off big expense outside normal monthly spending. Default monthly.' },
        note: { type: 'string' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'add_income',
    title: 'Record income',
    description: 'Record money received (salary, bonus, rent, dividends…).',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        source: { type: 'string', enum: INCOME_SOURCES, description: 'Default other.' },
        date: dateProp('Default today.'),
        recurring: { type: 'boolean', description: 'Comes every month (like salary). Default false.' },
        note: { type: 'string' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'add_person',
    title: 'Add a person',
    description: 'Add someone to People.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, relationship: { type: 'string' }, mobile: { type: 'string' },
        email: { type: 'string' }, birthday: dateProp('Optional birthday.'), notes: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'send_whatsapp',
    title: 'Send a WhatsApp message',
    description: "Send a WhatsApp message to someone. Use this WHENEVER the user asks to WhatsApp, message, text, remind or share something with a person — never reply that you can't send WhatsApp messages. It returns a link that opens WhatsApp on the user's phone with the chat and the message already typed; the user taps Send. Always show that link to the user as a tappable link (in voice mode, say it's on screen). Write the message yourself in the user's language, looking up details first (search, get_today) when it's about a task, appointment, agenda or note. `to` can be a name from People or a phone number; if the person isn't saved or has no number, the link still works and lets the user pick the chat.",
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'A name from People, or a phone number. Optional.' },
        text: { type: 'string', description: 'The message, ready to send. WhatsApp formatting works: *bold*, _italic_.' },
      },
      required: ['text'],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'add_document',
    title: 'Add a document',
    description: "Add a document to the app's Documents (ID, iqama, passport, licence, insurance, registration (istimara), contract, warranty, invoice, medical, certificate…). When the user shares a photo or scan, read it yourself and fill in the details — name, number, holder, issue and expiry dates. The photo itself can't be passed to the app: after adding, tell the user to tap \"Add photo\" on the document in The Assistant → Documents to attach it. The expiry date drives the app's renewal alerts, so include it whenever it's visible.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'e.g. "Iqama — Ahmed", "Car insurance — Land Cruiser".' },
        category: { type: 'string', enum: DOC_CATEGORIES, description: 'id = personal IDs (national ID, iqama, passport, licence); vehicle_reg = istimara. Default other.' },
        number: { type: 'string', description: 'Document / policy / ID number, if visible.' },
        expiry: { type: 'string', description: 'Expiry date as YYYY-MM-DD (convert Hijri dates to Gregorian).' },
        issued: { type: 'string', description: 'Issue date as YYYY-MM-DD, if visible.' },
        person: { type: 'string', description: 'Whose document it is — matched to People by name.' },
        vehicle: { type: 'string', description: 'Or the vehicle it belongs to — matched by name or plate.' },
        notes: { type: 'string', description: 'Anything else worth keeping (issuer, place, remarks).' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_item',
    title: 'Add to any part of the app',
    description: `Add a record to any other part of the app (trips, wishlist, goals, subscriptions, documents, vehicles, services, properties, giving, meetings…). Look at an existing record with list_items(full: true) first to copy its field names. Use the dedicated add_ tools for tasks, appointments, reminders, notes, expenses, income, people and documents. Collections: ${COLLECTIONS.filter(c => !NO_GENERIC_WRITE.has(c)).join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', enum: COLLECTIONS.filter(c => !NO_GENERIC_WRITE.has(c)) },
        fields: { type: 'object', description: 'The record\'s fields, e.g. {"name": "Umrah", "startDate": "2026-12-20"}.' },
      },
      required: ['collection', 'fields'],
    },
  },
  {
    name: 'update_item',
    title: 'Change an item',
    description: 'Change fields of an existing record — for example move an appointment, rename a task, fix an amount, or set a reminder\'s status ({"status": "todo" | "in_progress" | "done"}; a task\'s status is e.g. "in_progress" or "completed"). Only the fields given change. Get the id from search or list_items.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', enum: COLLECTIONS },
        id: { type: 'string' },
        changes: { type: 'object', description: 'Fields to set, e.g. {"date": "2026-11-25", "time": "16:00"}.' },
      },
      required: ['collection', 'id', 'changes'],
    },
  },
  {
    name: 'delete_item',
    title: 'Delete an item',
    description: 'Delete a record. It can still be restored from the app\'s backup history, but confirm with the user before deleting.',
    inputSchema: {
      type: 'object',
      properties: { collection: { type: 'string', enum: COLLECTIONS }, id: { type: 'string' } },
      required: ['collection', 'id'],
    },
    annotations: { destructiveHint: true },
  },
]

const INSTRUCTIONS = [
  "This is the user's personal organiser app, The Assistant: tasks and plans, calendar, reminders, notes, money (expenses, income, budgets), people, vehicles, documents, trips and more.",
  'Use get_today before working with relative dates. Dates are YYYY-MM-DD and times 24-hour HH:MM in the user\'s own time zone.',
  'To change or delete something, find it first with search or list_items to get its id.',
  'You CAN send WhatsApp messages: when the user asks to WhatsApp, message or share something with someone, call send_whatsapp and show the link it returns — they tap it and press Send. Never say you cannot send WhatsApp messages.',
  'Email: if the user also has an email connector (e.g. Gmail), you can bring things from their inbox into the app when they ask. Flight/hotel bookings → a trip with add_item(collection "trips", {name, destination, start, end, notes}) plus each flight or check-in as add_item(collection "itinerary", {tripId, date, time, title, note}); appointment or meeting invitations → add_appointment; bills and receipts → add_expense (or add_item "subscriptions" with {name, amount, currency, cycle, nextDue} for recurring ones); documents (IDs, insurance, contracts) → add_document. Search the app first so you don\'t add something twice, and say what you added.',
  'After acting, confirm in one short sentence what changed (the user is often speaking, not reading). Changes appear on their phone within seconds when the app is open.',
].join(' ')

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------
class ToolError extends Error {}
const fail = (msg) => { throw new ToolError(msg) }

function newRecord(fields, now) {
  return { id: uid(), ...fields, createdAt: now, updatedAt: now, deletedAt: null }
}

async function findOpenTask(store, hid, { id, title }) {
  const tasks = await store.list(hid, 'tasks')
  const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  if (id) return tasks.find(t => t.id === id) || null
  const n = str(title).toLowerCase()
  if (!n) return null
  const exact = open.filter(t => (t.title || '').toLowerCase() === n)
  if (exact.length) return exact[0]
  const near = open.filter(t => { const x = (t.title || '').toLowerCase(); return x && (x.includes(n) || n.includes(x)) })
  if (near.length > 1) fail(`Several open tasks match "${title}": ${near.slice(0, 5).map(t => `"${t.title}" (id ${t.id})`).join(', ')}. Ask which one, then pass its id.`)
  return near[0] || null
}

const textOf = (r) => [r.title, r.text, r.name, r.item, r.merchant, r.nickname, r.description, r.note, r.notes, r.location, r.assignedTo, r.category, r.source]
  .filter(v => typeof v === 'string').join(' ').toLowerCase()

export async function callTool(name, args, ctx) {
  const { store, hid, tz, currency } = ctx
  const a = args || {}
  const now = new Date().toISOString()
  const today = todayIn(tz)

  switch (name) {
    case 'get_today': {
      const [tasks, appts, rems, exps] = await Promise.all(['tasks', 'appointments', 'reminders', 'expenses'].map(c => store.list(hid, c)))
      const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      const overdue = open.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today)
      const dueToday = open.filter(t => t.dueDate && t.dueDate.slice(0, 10) === today)
      const apptsToday = appts.filter(x => (x.date || '').slice(0, 10) === today).sort((x, y) => (x.time || '99').localeCompare(y.time || '99'))
      const endOfDay = localToISO(`${today}T23:59`, tz)
      const remsToday = rems.filter(r => !r.done && r.remindAt && r.remindAt >= now && r.remindAt <= endOfDay)
      const month = today.slice(0, 7)
      const spent = {}
      exps.filter(e => (e.date || '').slice(0, 7) === month).forEach(e => {
        const c = e.currency || currency; spent[c] = (spent[c] || 0) + (Number(e.amount) || 0)
      })
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date())
      const lines = [
        `Today is ${weekday} ${today} (time zone ${tz}). Now: ${isoToLocal(now, tz)}.`,
        `Overdue tasks (${overdue.length}): ${overdue.map(t => `${t.title} [id ${t.id}, due ${t.dueDate}]`).join('; ') || 'none'}`,
        `Due today (${dueToday.length}): ${dueToday.map(t => `${t.title}${t.dueTime ? ' at ' + t.dueTime : ''} [id ${t.id}]`).join('; ') || 'none'}`,
        `Appointments today (${apptsToday.length}): ${apptsToday.map(x => `${x.time ? x.time + ' ' : ''}${x.title}${x.location ? ' @ ' + x.location : ''} [id ${x.id}]`).join('; ') || 'none'}`,
        `Reminders still to come today: ${remsToday.map(r => `${isoToLocal(r.remindAt, tz).slice(11)} ${r.text} [id ${r.id}]`).join('; ') || 'none'}`,
        `Spent this month: ${Object.entries(spent).map(([c, v]) => `${Math.round(v * 100) / 100} ${c}`).join(', ') || 'nothing yet'}`,
      ]
      return lines.join('\n')
    }

    case 'search': {
      const q = str(a.query).toLowerCase()
      if (!q) fail('Say what to search for.')
      if (a.collection && !COLLECTIONS.includes(a.collection)) fail(`Unknown collection "${a.collection}".`)
      const words = q.split(/\s+/).filter(Boolean)
      const rows = a.collection
        ? (await store.list(hid, a.collection)).map(data => ({ collection: a.collection, data }))
        : await store.listAll(hid)
      const hits = rows.filter(({ data }) => { const t = textOf(data); return words.every(w => t.includes(w)) })
      const limit = Math.min(Math.max(1, Number(a.limit) || 15), 50)
      if (!hits.length) return `Nothing found for "${a.query}".`
      return hits.slice(0, limit).map(({ collection, data }) => `${collection} [id ${data.id}]: ${describe(collection, data, tz)}`).join('\n')
        + (hits.length > limit ? `\n…and ${hits.length - limit} more.` : '')
    }

    case 'list_items': {
      const c = a.collection
      if (!COLLECTIONS.includes(c)) fail(`Unknown collection "${c}". Use one of: ${COLLECTIONS.join(', ')}.`)
      let list = await store.list(hid, c)
      if (c === 'tasks') {
        if (!a.include_done) list = list.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
        list.sort((x, y) => (x.dueDate || '9999').localeCompare(y.dueDate || '9999'))
      } else if (c === 'appointments') {
        if (!a.include_done) list = list.filter(x => (x.date || '') >= today)
        list.sort((x, y) => `${x.date}${x.time || ''}`.localeCompare(`${y.date}${y.time || ''}`))
      } else if (c === 'reminders') {
        if (!a.include_done) list = list.filter(r => !r.done)
        list.sort((x, y) => (x.remindAt || '').localeCompare(y.remindAt || ''))
      } else {
        list.sort((x, y) => (y.date || y.createdAt || '').localeCompare(x.date || x.createdAt || ''))
      }
      const limit = Math.min(Math.max(1, Number(a.limit) || 20), 100)
      if (!list.length) return `No ${c} yet.`
      const shown = list.slice(0, limit)
      const body = a.full
        ? JSON.stringify(shown.map(stripHeavy), null, 1)
        : shown.map(r => `[id ${r.id}] ${describe(c, r, tz)}`).join('\n')
      return `${list.length} ${c}${list.length > limit ? ` (showing ${limit})` : ''}:\n${body}`
    }

    case 'add_task': {
      const title = str(a.title) || fail('A task needs a title.')
      if (a.due_date && !isDate(a.due_date)) fail('due_date must be YYYY-MM-DD.')
      if (a.due_time && !isTime(a.due_time)) fail('due_time must be HH:MM.')
      let assignee = null
      if (a.assigned_to) {
        const people = await store.list(hid, 'people')
        const n = str(a.assigned_to).toLowerCase()
        assignee = people.find(p => (p.name || '').toLowerCase() === n) || people.find(p => (p.name || '').toLowerCase().includes(n)) || null
      }
      const rec = newRecord({
        title, type: 'task',
        classification: a.classification === 'work' ? 'work' : 'personal',
        priority: PRIORITIES.includes(a.priority) ? a.priority : 'medium',
        status: a.due_date ? 'planned' : 'new',
        dueDate: a.due_date || '', dueTime: a.due_time || '',
        description: str(a.notes),
        recurrence: ['daily', 'weekly', 'monthly', 'yearly'].includes(a.repeat) ? a.repeat : 'none',
        ...(a.assigned_to ? { assignedTo: assignee ? assignee.name : str(a.assigned_to), assigneeId: assignee ? assignee.id : '' } : {}),
        source: 'claude',
      }, now)
      await store.put(hid, 'tasks', rec)
      return `Added task "${title}"${rec.dueDate ? ` due ${rec.dueDate}${rec.dueTime ? ' ' + rec.dueTime : ''}` : ''} [id ${rec.id}].`
    }

    case 'complete_task': {
      if (!a.id && !a.title) fail('Give the task id or title.')
      const task = await findOpenTask(store, hid, a)
      if (!task) fail(`No open task matching "${a.id || a.title}".`)
      if (task.status === 'completed') return `"${task.title}" was already done.`
      await store.put(hid, 'tasks', { ...task, status: 'completed', completedAt: now, updatedAt: now })
      let extra = ''
      const nd = task.recurrence && task.recurrence !== 'none' ? nextDate((task.dueDate || today).slice(0, 10), task.recurrence) : null
      if (nd) {
        const { id, createdAt, updatedAt, completedAt, ...rest } = task
        const next = newRecord({ ...rest, status: 'planned', dueDate: nd, completedAt: null }, now)
        await store.put(hid, 'tasks', next)
        extra = ` Next one is due ${nd}.`
      }
      return `Marked "${task.title}" done.${extra}`
    }

    case 'add_appointment': {
      const title = str(a.title) || fail('An appointment needs a title.')
      if (!isDate(a.date)) fail('date must be YYYY-MM-DD.')
      if (a.time && !isTime(a.time)) fail('time must be HH:MM.')
      let personId = ''
      if (a.person) {
        const n = str(a.person).toLowerCase()
        const p = (await store.list(hid, 'people')).find(x => (x.name || '').toLowerCase().includes(n))
        if (p) personId = p.id
      }
      const rec = newRecord({
        title, type: APPT_TYPES.includes(a.type) ? a.type : 'other', personId,
        date: a.date, time: a.time || '', location: str(a.location), note: str(a.note), source: 'claude',
      }, now)
      await store.put(hid, 'appointments', rec)
      return `Added "${title}" on ${a.date}${a.time ? ' at ' + a.time : ''}${rec.location ? ' at ' + rec.location : ''} [id ${rec.id}].`
    }

    case 'add_reminder': {
      const text = str(a.text) || fail('Say what to remind about.')
      const iso = localToISO(a.at, tz) || fail('at must be YYYY-MM-DDTHH:MM in the user\'s local time.')
      const past = new Date(iso).getTime() <= Date.now()
      // Same fields as buildReminderFields() in the app (src/lulu/lib/reminders.js).
      const rec = newRecord({
        text, times: [iso], firedCount: past ? 1 : 0, remindAt: iso, notified: past,
        repeat: ['daily', 'weekly', 'monthly'].includes(a.repeat) ? a.repeat : 'none', done: false, status: 'todo', source: 'claude',
      }, now)
      await store.put(hid, 'reminders', rec)
      return `Reminder set for ${isoToLocal(iso, tz)}: "${text}"${past ? ' (that time has already passed, so it will not ring)' : ''} [id ${rec.id}].`
    }

    case 'add_note': {
      const text = str(a.text) || fail('The note is empty.')
      const rec = newRecord({ text, source: 'claude' }, now)
      await store.put(hid, 'notes', rec)
      return `Saved the note [id ${rec.id}].`
    }

    case 'add_expense': {
      const amount = num(a.amount)
      if (!(amount > 0)) fail('An expense needs an amount above zero.')
      if (a.date && !isDate(a.date)) fail('date must be YYYY-MM-DD.')
      const cur = str(a.currency).toUpperCase() || currency
      const category = EXPENSE_CATEGORIES.includes(a.category) ? a.category : 'other'
      const rec = newRecord({
        amount, currency: cur, category, merchant: str(a.merchant), item: str(a.item),
        method: PAYMENT_METHODS.includes(a.method) ? a.method : 'credit',
        date: a.date || today, classification: 'personal', kind: a.kind === 'special' ? 'special' : 'monthly',
        account: '', reimbursable: false, relatedVehicle: '', projectId: '', tripId: '',
        note: str(a.note), liters: '', odometer: '', installmentMonths: '', receipts: [], source: 'claude',
      }, now)
      await store.put(hid, 'expenses', rec)
      return `Logged ${amount} ${cur} ${category}${rec.merchant ? ' at ' + rec.merchant : ''} on ${rec.date} [id ${rec.id}].`
    }

    case 'add_income': {
      const amount = num(a.amount)
      if (!(amount > 0)) fail('Income needs an amount above zero.')
      if (a.date && !isDate(a.date)) fail('date must be YYYY-MM-DD.')
      const cur = str(a.currency).toUpperCase() || currency
      const rec = newRecord({
        source: INCOME_SOURCES.includes(a.source) ? a.source : 'other', amount, currency: cur,
        date: a.date || today, recurring: !!a.recurring, account: '', note: str(a.note), origin: 'claude',
      }, now)
      await store.put(hid, 'income', rec)
      return `Recorded ${amount} ${cur} income (${rec.source}) on ${rec.date} [id ${rec.id}].`
    }

    case 'add_person': {
      const name2 = str(a.name) || fail('A person needs a name.')
      const mobile = str(a.mobile)
      const rec = newRecord({
        name: name2, relationship: str(a.relationship), mobile, whatsapp: mobile, phone: mobile,
        email: str(a.email), birthday: isDate(a.birthday) ? a.birthday : '', notes: str(a.notes), points: 0, source: 'claude',
      }, now)
      await store.put(hid, 'people', rec)
      return `Added ${name2} to People [id ${rec.id}].`
    }

    case 'send_whatsapp': {
      const text = str(a.text) || fail('Write the message first.')
      const picker = `https://wa.me/?text=${encodeURIComponent(text)}`
      const to = str(a.to)
      if (!to) return `Message ready. Show this link to the user — it opens WhatsApp with the message typed; they choose the chat and tap Send:\n${picker}`
      if (/^[+0-9][0-9\s()-]{6,}$/.test(to)) {
        const digits = waNumber(to, ctx.countryCode)
        if (!digits) fail(`"${to}" doesn't look like a phone number.`)
        return `Message ready for ${to}. Show this link to the user — it opens WhatsApp with that chat and the message typed; they tap Send:\nhttps://wa.me/${digits}?text=${encodeURIComponent(text)}`
      }
      const people = await store.list(hid, 'people')
      const n = to.toLowerCase()
      const exact = people.filter(p => (p.name || '').toLowerCase() === n)
      const near = exact.length ? exact : people.filter(p => { const x = (p.name || '').toLowerCase(); return x && (x.includes(n) || n.includes(x)) })
      if (near.length > 1) fail(`Several people match "${to}": ${near.slice(0, 6).map(p => p.name).join(', ')}. Ask which one, then call send_whatsapp again with the full name.`)
      const person = near[0]
      const digits = person ? waNumber(person.whatsapp || person.mobile || person.phone, ctx.countryCode) : ''
      if (!digits) {
        const why = person ? `${person.name} has no phone number saved in People` : `"${to}" isn't saved in People`
        return `Message ready. ${why}, so this link opens WhatsApp and the user picks ${person ? person.name : to}'s chat, then taps Send. Show it to the user (and offer to save their number with add_person / update_item):\n${picker}`
      }
      return `Message ready for ${person.name}. Show this link to the user — it opens WhatsApp with ${person.name}'s chat and the message typed; they tap Send:\nhttps://wa.me/${digits}?text=${encodeURIComponent(text)}`
    }

    case 'add_document': {
      const title = str(a.title) || fail('A document needs a title.')
      for (const k of ['expiry', 'issued']) if (a[k] && !isDate(a[k])) fail(`${k} must be YYYY-MM-DD.`)
      const fields = {
        title, category: DOC_CATEGORIES.includes(a.category) ? a.category : 'other', vaultId: '',
        expiry: a.expiry || '', notes: [a.number ? `No. ${str(a.number)}` : '', a.issued ? `Issued ${a.issued}` : '', str(a.notes)].filter(Boolean).join('\n'),
        attachments: [], source: 'claude',
      }
      if (a.number) fields.number = str(a.number)
      if (a.issued) fields.issued = a.issued
      let linked = ''
      const find = (list, q, keys) => { const n = str(q).toLowerCase(); return list.find(x => keys.some(k => (x[k] || '').toLowerCase() === n)) || list.find(x => keys.some(k => { const v = (x[k] || '').toLowerCase(); return v && (v.includes(n) || n.includes(v)) })) }
      if (a.person) {
        const p = find(await store.list(hid, 'people'), a.person, ['name'])
        if (p) { fields.personId = p.id; linked = ` for ${p.name}` } else fields.notes = [fields.notes, `Holder: ${str(a.person)}`].filter(Boolean).join('\n')
      } else if (a.vehicle) {
        const v = find(await store.list(hid, 'vehicles'), a.vehicle, ['nickname', 'name', 'plate', 'plateNumber'])
        if (v) { fields.vehicleId = v.id; linked = ` for ${v.nickname || v.name}` }
      }
      const rec = newRecord(fields, now)
      await store.put(hid, 'documents', rec)
      return `Added document "${title}"${linked}${rec.expiry ? `, expires ${rec.expiry}` : ''} [id ${rec.id}]. Tell the user: to attach the photo, open The Assistant → Documents and tap "Add photo" on it.`
    }

    case 'add_item': {
      const c = a.collection
      if (!COLLECTIONS.includes(c) || NO_GENERIC_WRITE.has(c)) fail(`Can't add to "${c}" this way.`)
      if (!a.fields || typeof a.fields !== 'object' || Array.isArray(a.fields)) fail('fields must be an object.')
      const { id, createdAt, updatedAt, deletedAt, ...fields } = a.fields
      const rec = newRecord({ ...fields, source: 'claude' }, now)
      await store.put(hid, c, rec)
      return `Added to ${c}: ${describe(c, rec, tz)} [id ${rec.id}].`
    }

    case 'update_item': {
      const c = a.collection
      if (!COLLECTIONS.includes(c) || NO_GENERIC_WRITE.has(c)) fail(`Can't change "${c}" this way.`)
      if (!a.changes || typeof a.changes !== 'object' || Array.isArray(a.changes)) fail('changes must be an object.')
      const cur = await store.get(hid, a.id)
      if (!cur || cur.collection !== c || cur.data.deletedAt) fail(`No ${c} item with id ${a.id}. Use search to find it.`)
      const { id, createdAt, updatedAt, deletedAt, ...changes } = a.changes
      let next = { ...cur.data, ...changes, updatedAt: now }
      // Reminders: `status` (todo | in_progress | done) and `done` move together.
      if (c === 'reminders' && ('status' in changes || 'done' in changes)) {
        const st = 'status' in changes ? changes.status : (changes.done ? 'done' : (cur.data.status === 'in_progress' ? 'in_progress' : 'todo'))
        if (!['todo', 'in_progress', 'done'].includes(st)) fail('A reminder status is todo, in_progress or done.')
        next = { ...next, status: st, done: st === 'done', doneAt: st === 'done' ? now : null }
      }
      // A reminder moved to a new time must ring again at that time.
      if (c === 'reminders' && (changes.at || changes.remindAt)) {
        const iso = changes.at ? localToISO(changes.at, tz) : changes.remindAt
        if (!iso) fail('at must be YYYY-MM-DDTHH:MM.')
        const past = new Date(iso).getTime() <= Date.now()
        delete next.at
        next = { ...next, times: [iso], remindAt: iso, firedCount: past ? 1 : 0, notified: past }
      }
      await store.put(hid, c, next)
      return `Updated: ${describe(c, next, tz)}.`
    }

    case 'delete_item': {
      const c = a.collection
      if (!COLLECTIONS.includes(c) || NO_GENERIC_WRITE.has(c)) fail(`Can't delete from "${c}" this way.`)
      const cur = await store.get(hid, a.id)
      if (!cur || cur.collection !== c || cur.data.deletedAt) fail(`No ${c} item with id ${a.id}.`)
      // A soft delete, exactly like the app's own delete.
      await store.put(hid, c, { ...cur.data, deletedAt: now, updatedAt: now })
      return `Deleted: ${describe(c, cur.data, tz)}.`
    }

    default:
      fail(`Unknown tool "${name}".`)
  }
}

// Photos and files are stored inline as data URLs; never send those to Claude.
function stripHeavy(r) {
  const out = {}
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'string' && v.startsWith('data:')) out[k] = '[file]'
    else if (Array.isArray(v) && v.some(x => x && typeof x === 'object' && Object.values(x).some(y => typeof y === 'string' && y.startsWith('data:')))) out[k] = `[${v.length} files]`
    else out[k] = v
  }
  return out
}


// ===========================================================================
// A. Apple Calendar feed — GET …/lulu-mcp/<lulucal_ key>/calendar.ics
// A read-only link (its own key, prefix lulucal_) that Calendar subscribes to.
// UIDs are stable, so Calendar updates events in place instead of duplicating.
// ===========================================================================
const icsEsc = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsFold = (line) => {
  if (line.length <= 73) return line
  let out = line.slice(0, 73), rest = line.slice(73)
  while (rest.length > 72) { out += '\r\n ' + rest.slice(0, 72); rest = rest.slice(72) }
  return out + '\r\n ' + rest
}
const icsUtc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsDate = (d) => d.replace(/-/g, '')

// data: { appointments, tasks, reminders, documents } (live records only)
export function buildCalendar(data, tz, now = new Date()) {
  const today = todayIn(tz, now), from = addDays(today, -30), to = addDays(today, 400)
  const inRange = (d) => d && d >= from && d <= to
  const ev = []
  const timed = (uid, startIso, mins, summary, extra = {}) => ev.push({ uid, start: startIso, end: new Date(Date.parse(startIso) + mins * 60000).toISOString(), summary, ...extra })
  const allDay = (uid, date, summary, extra = {}) => ev.push({ uid, date, summary, ...extra })
  for (const a of data.appointments || []) {
    const d = (a.date || '').slice(0, 10); if (!inRange(d)) continue
    const extra = { location: a.location, desc: a.note }
    if (isTime(a.time)) timed(`appt-${a.id}`, localToISO(`${d}T${a.time}`, tz), 60, a.title || 'Appointment', extra)
    else allDay(`appt-${a.id}`, d, a.title || 'Appointment', extra)
  }
  for (const t of data.tasks || []) {
    if (t.status === 'completed' || t.status === 'cancelled') continue
    const d = (t.dueDate || '').slice(0, 10); if (!inRange(d)) continue
    const summary = `☐ ${t.title || 'Task'}`
    if (isTime(t.dueTime)) timed(`task-${t.id}`, localToISO(`${d}T${t.dueTime}`, tz), 30, summary, { desc: t.description })
    else allDay(`task-${t.id}`, d, summary, { desc: t.description })
  }
  for (const r of data.reminders || []) {
    if (r.done) continue
    const times = Array.isArray(r.times) && r.times.length ? r.times : (r.remindAt ? [r.remindAt] : [])
    times.forEach((iso, i) => { const d = isoToLocal(iso, tz).slice(0, 10); if (inRange(d)) timed(`rem-${r.id}-${i}`, iso, 15, `🔔 ${r.text || 'Reminder'}`) })
  }
  for (const doc of data.documents || []) {
    const d = (doc.expiry || '').slice(0, 10); if (!inRange(d)) continue
    allDay(`doc-${doc.id}`, d, `📄 ${doc.title || 'Document'} expires`)
  }
  const stamp = icsUtc(now.toISOString())
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Assistant//Calendar feed//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:The Assistant', `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M']
  for (const e of ev) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}@the-assistant`, `DTSTAMP:${stamp}`)
    if (e.date) {
      const next = addDays(e.date, 1)
      L.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(next)}`)
    } else L.push(`DTSTART:${icsUtc(e.start)}`, `DTEND:${icsUtc(e.end)}`)
    L.push(`SUMMARY:${icsEsc(e.summary)}`)
    if (e.location) L.push(`LOCATION:${icsEsc(e.location)}`)
    if (e.desc) L.push(`DESCRIPTION:${icsEsc(e.desc)}`)
    L.push('END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return { text: L.map(icsFold).join('\r\n') + '\r\n', count: ev.length }
}

// ===========================================================================
// C. Background push — every minute (…/lulu-mcp/cron) send due reminders,
// due-today alerts (daytime only) and the morning brief to the household's
// devices. Everything lives in the records table (no extra tables):
//   _pushsub   one per device subscription   (written by the app)
//   _pushalert one per alert already sent    (de-duplication)
//   _pushcfg   'pushcfg': last run time      (for the app's checklist)
// ===========================================================================
export const PUSH_SUB = '_pushsub', PUSH_ALERT = '_pushalert', PUSH_CFG = '_pushcfg'
const dateOnly = (v) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null)

function localMinutes(tz, now) { const t = isoToLocal(now.toISOString(), tz).slice(11); return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) }

export function computeDueAlerts(by, today) {
  const out = []
  const of = (c) => (by[c] || []).filter(x => x && !x.deletedAt)
  for (const x of of('tasks')) {
    if (x.status === 'completed' || x.status === 'cancelled') continue
    const dd = dateOnly(x.dueDate); if (!dd || dd > today) continue
    out.push({ key: `task:${x.id}:${dd}`, title: dd < today ? 'Overdue task' : 'Task due today', body: x.title || 'Task', url: '#/plan' })
  }
  for (const x of of('appointments')) {
    const dd = dateOnly(x.date); if (dd !== today) continue
    out.push({ key: `appt:${x.id}:${dd}`, title: 'Appointment today', body: `${x.title || 'Appointment'}${x.time ? ` · ${x.time}` : ''}`, url: '#/plan' })
  }
  for (const x of of('subscriptions')) {
    if (x.active === false) continue
    const dd = dateOnly(x.nextDue); if (!dd || dd > today) continue
    out.push({ key: `sub:${x.id}:${dd}`, title: 'Payment due', body: x.name || 'Subscription', url: '#/subscriptions' })
  }
  for (const x of of('documents')) {
    const dd = dateOnly(x.expiry); if (!dd || dd > today) continue
    out.push({ key: `doc:${x.id}:${dd}`, title: 'Document expiring', body: x.title || 'Document', url: '#/documents' })
  }
  const year = today.slice(0, 4)
  for (const x of of('people')) {
    const b = dateOnly(x.birthday)
    if (b && b.slice(5) === today.slice(5)) out.push({ key: `bd:${x.id}:${year}`, title: 'Birthday today', body: x.name || 'Someone', url: '#/people' })
  }
  return out
}

export function briefBody(by, today) {
  const of = (c) => (by[c] || []).filter(x => x && !x.deletedAt)
  const open = of('tasks').filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter(t => dateOnly(t.dueDate) === today)
  const overdue = open.filter(t => { const d = dateOnly(t.dueDate); return d && d < today })
  const appts = of('appointments').filter(a => dateOnly(a.date) === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const parts = []
  if (dueToday.length) parts.push(`${dueToday.length} due today`)
  if (overdue.length) parts.push(`${overdue.length} overdue`)
  if (appts.length) parts.push(`${appts[0].time ? appts[0].time + ' ' : ''}${appts[0].title}${appts.length > 1 ? ` +${appts.length - 1}` : ''}`)
  return parts.length ? parts.join(' · ') : 'Your day is clear.'
}

// push: { send(subscription, payloadString) } — throws { statusCode } on failure.
async function pushToDevices(store, push, hid, subs, payload) {
  let delivered = 0
  for (const s of subs) {
    try { await push.send(s.subscription, JSON.stringify(payload)); delivered++ }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) { try { await store.del(hid, s.id) } catch { /* ignore */ } } }
  }
  return delivered
}

export async function runPushCron({ store, push, tz, now = new Date() }) {
  const nowIso = now.toISOString(), nowMs = now.getTime()
  const today = todayIn(tz, now), mins = localMinutes(tz, now)
  const subsAll = await store.listCollectionAll(PUSH_SUB)
  const byHouse = new Map()
  for (const r of subsAll) { if (!r.data || r.data.deletedAt || !r.data.subscription) continue; if (!byHouse.has(r.household_id)) byHouse.set(r.household_id, []); byHouse.get(r.household_id).push({ id: r.id, subscription: r.data.subscription }) }
  const households = await store.listHouseholds()
  const totals = { households: households.length, devices: subsAll.length, reminders: 0, alerts: 0, briefs: 0 }
  for (const hid of households) {
    // Heartbeat, so the app can show "runs every minute".
    await store.put(hid, PUSH_CFG, { id: 'pushcfg', lastRunAt: nowIso, createdAt: nowIso, updatedAt: nowIso, deletedAt: null })
    const subs = byHouse.get(hid) || []
    if (!subs.length) continue

    // Reminders: up to 3 times each (`times`), `firedCount` of them alerted.
    for (const d of await store.list(hid, 'reminders')) {
      if (d.done) continue
      const times = (Array.isArray(d.times) && d.times.length ? [...new Set(d.times.filter(Boolean))].sort() : (d.remindAt ? [d.remindAt] : []))
      const fired = typeof d.firedCount === 'number' ? d.firedCount : (d.notified ? times.length : 0)
      const passed = times.filter(t => t <= nowIso).length
      if (passed <= fired) continue
      if (!(await pushToDevices(store, push, hid, subs, { title: 'Reminder', body: d.text || '', tag: 'reminder-' + d.id, url: '#/reminders' }))) continue
      totals.reminders++
      let next
      if (passed >= times.length && d.repeat && d.repeat !== 'none') {
        const ds = times.map(t => new Date(t))
        let guard = 0
        do { ds.forEach(x => { d.repeat === 'monthly' ? x.setUTCMonth(x.getUTCMonth() + 1) : x.setUTCDate(x.getUTCDate() + (d.repeat === 'weekly' ? 7 : 1)) }); guard++ }
        while (Math.max(...ds.map(x => x.getTime())) <= nowMs && guard < 400)
        const nt = ds.map(x => x.toISOString())
        next = { ...d, times: nt, firedCount: 0, remindAt: nt[0], notified: false, notifiedAt: nowIso, updatedAt: nowIso }
      } else {
        next = { ...d, firedCount: passed, remindAt: times[Math.min(passed, times.length - 1)] || null, notified: passed >= times.length, notifiedAt: nowIso, updatedAt: nowIso }
      }
      await store.put(hid, 'reminders', next) // updatedAt moves: the phone takes this copy
    }

    // Due-today alerts (07:00–22:00 local) and the morning brief (07:30–10:00).
    const daytime = mins >= 7 * 60 && mins < 22 * 60
    const briefTime = mins >= 7 * 60 + 30 && mins < 10 * 60
    if (!daytime) continue
    const by = {}
    for (const c of ['tasks', 'appointments', 'subscriptions', 'documents', 'people']) by[c] = await store.list(hid, c)
    const seen = new Set((await store.list(hid, PUSH_ALERT)).map(a => a.key))
    const items = computeDueAlerts(by, today).filter(i => !seen.has(i.key))
    if (briefTime && !seen.has(`brief:${today}`)) items.unshift({ key: `brief:${today}`, title: '☀️ Good morning', body: briefBody(by, today), url: '#/today' })
    for (const it of items) {
      if (await pushToDevices(store, push, hid, subs, { title: it.title, body: it.body, tag: 'due-' + it.key, url: it.url })) {
        it.key.startsWith('brief:') ? totals.briefs++ : totals.alerts++
        await store.put(hid, PUSH_ALERT, { id: 'alert:' + it.key, key: it.key, sentAt: nowIso, createdAt: nowIso, updatedAt: nowIso, deletedAt: null })
      }
    }
  }
  return totals
}

// The app's push requests (POST …/lulu-mcp/push, signed-in user):
//   { action: 'key' } · { action: 'status', household_id, endpoint } · { action: 'test', household_id }
async function handlePush(req, { store, push }) {
  let body = {}
  try { body = await req.json() } catch { /* empty */ }
  if (body.action === 'key') return json({ publicKey: push.publicKey })
  const hid = body.household_id
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const user = token ? await store.userFromToken(token) : null
  if (!user || !hid || !(await store.isMember(hid, user.id))) return json({ error: 'not-allowed' }, 403)
  const subs = (await store.list(hid, PUSH_SUB)).filter(s => s.subscription)
  if (body.action === 'status') {
    const cfg = (await store.list(hid, PUSH_CFG))[0]
    let cron = null
    try { cron = await store.cronStatus() } catch { cron = null }
    return json({ ok: true, publicKey: push.publicKey, subscriptions: subs.length, registered: !!(body.endpoint && subs.some(s => s.endpoint === body.endpoint)), lastRun: cfg ? cfg.lastRunAt : null, cron, now: new Date().toISOString() })
  }
  if (body.action === 'test') {
    const sent = await pushToDevices(store, push, hid, subs.map(s => ({ id: s.id, subscription: s.subscription })), { title: 'Test push ✅', body: 'Background reminders are working.', tag: 'lulu-test', url: '#/reminders' })
    return json({ test: true, subscriptions: subs.length, sent })
  }
  return json({ error: 'unknown action' }, 400)
}

// ---------------------------------------------------------------------------
// HTTP + JSON-RPC
// ---------------------------------------------------------------------------
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const STATUS_PAGE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
  + '<title>The Assistant connector</title><body style="font:18px system-ui;margin:40px;max-width:560px">'
  + '<h1 style="font-size:24px">✅ The Assistant connector is running</h1>'
  + '<p>This is the address Claude talks to. Next: in the app, More → Settings → Manage cloud &amp; family → '
  + '<b>Make a Claude link</b>, then add that link in Claude → Settings → Connectors.</p></body>'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id, x-lulu-key, authorization',
  'access-control-allow-methods': 'POST, GET, OPTIONS, DELETE',
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } })
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

// The connector key: in the URL (…/lulu-mcp/<key>), or a header.
export function keyFrom(req) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.lastIndexOf('lulu-mcp')
  if (at >= 0 && parts[at + 1] && parts[at + 1].startsWith('lulu_')) return parts[at + 1]
  const h = req.headers.get('x-lulu-key')
  if (h) return h.trim()
  const auth = req.headers.get('authorization') || ''
  const m = /^Bearer\s+(lulu_\S+)$/i.exec(auth)
  return m ? m[1] : null
}

/**
 * createHandler({ store, tz, currency }) → (Request) => Promise<Response>
 * store: { household(keyHash) → hid|null, list(hid, collection) → data[],
 *          listAll(hid) → [{collection, data}], get(hid, id) → {collection, data}|null,
 *          put(hid, collection, record) }
 */
export function createHandler({ store, push = /** @type {any} */ (null), tz = 'Asia/Riyadh', currency = 'SAR', countryCode = '966' }) {
  async function handleMessage(msg, hid) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg && msg.id, -32600, 'Invalid request')
    const isNotification = msg.id === undefined || msg.id === null
    if (isNotification) return null
    const { id, method, params = {} } = msg
    try {
      if (method === 'initialize') {
        const asked = params.protocolVersion
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[1],
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          },
        }
      }
      if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }
      if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } }
      if (method === 'tools/call') {
        const tool = TOOLS.find(t => t.name === params.name)
        if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`)
        try {
          const text = await callTool(params.name, params.arguments || {}, { store, hid, tz, currency, countryCode })
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } }
        } catch (e) {
          if (e instanceof ToolError) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: e.message }], isError: true } }
          throw e
        }
      }
      if (method === 'resources/list') return { jsonrpc: '2.0', id, result: { resources: [] } }
      if (method === 'prompts/list') return { jsonrpc: '2.0', id, result: { prompts: [] } }
      return rpcError(id, -32601, `Method not found: ${method}`)
    } catch (e) {
      return rpcError(id, -32603, 'Server error: ' + (e && e.message ? e.message : String(e)))
    }
  }

  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    const parts = new URL(req.url).pathname.split('/').filter(Boolean)
    const at = parts.lastIndexOf('lulu-mcp')
    const rest = at >= 0 ? parts.slice(at + 1) : []

    // A. Calendar feed: …/lulu-mcp/<lulucal_ key>/calendar.ics (read-only key).
    if (rest[0] && rest[0].startsWith('lulucal_') && /\.ics$/.test(rest[1] || '')) {
      const hidCal = await store.household(await sha256Hex(rest[0]))
      if (!hidCal) return new Response('This calendar link was removed. Make a new one in The Assistant.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      const [appointments, tasks, reminders, documents] = await Promise.all(['appointments', 'tasks', 'reminders', 'documents'].map(c => store.list(hidCal, c)))
      const cal = buildCalendar({ appointments, tasks, reminders, documents }, tz)
      return new Response(cal.text, { status: 200, headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-cache', ...CORS } })
    }
    // C. Background push: the app's requests, and the every-minute run.
    if (rest[0] === 'push' && req.method === 'POST') {
      if (!push) return json({ error: 'push-unavailable' }, 503)
      return handlePush(req, { store, push })
    }
    if (rest[0] === 'cron') {
      if (!push) return json({ error: 'push-unavailable' }, 503)
      return json(await runPushCron({ store, push, tz }))
    }
    // Opened in a browser: a plain status page, so setup can be checked by
    // just visiting the address. (MCP clients never ask for text/html.)
    if (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html')) {
      return new Response(STATUS_PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    // No server-initiated stream: the spec's answer for that is 405.
    if (req.method === 'GET' || req.method === 'DELETE') return new Response(null, { status: 405, headers: { allow: 'POST', ...CORS } })
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: CORS })

    const key = keyFrom(req)
    const hid = key ? await store.household(await sha256Hex(key)) : null
    if (!hid) return json({ error: 'This connector link is not valid. Make a new one in the app: More → Settings → Cloud & family → Connect Claude.' }, 401)

    let body
    try { body = await req.json() } catch { return json(rpcError(null, -32700, 'Parse error'), 400) }

    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(m => handleMessage(m, hid)))).filter(Boolean)
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS })
    }
    const res = await handleMessage(body, hid)
    return res ? json(res) : new Response(null, { status: 202, headers: CORS })
  }
}
