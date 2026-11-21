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
    if (r.done) bits.push('done')
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
    name: 'add_item',
    title: 'Add to any part of the app',
    description: `Add a record to any other part of the app (trips, wishlist, goals, subscriptions, documents, vehicles, services, properties, giving, meetings…). Look at an existing record with list_items(full: true) first to copy its field names. Use the dedicated add_ tools for tasks, appointments, reminders, notes, expenses, income and people. Collections: ${COLLECTIONS.filter(c => !NO_GENERIC_WRITE.has(c)).join(', ')}.`,
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
    description: 'Change fields of an existing record — for example move an appointment, rename a task, fix an amount. Only the fields given change. Get the id from search or list_items.',
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
        repeat: ['daily', 'weekly', 'monthly'].includes(a.repeat) ? a.repeat : 'none', done: false, source: 'claude',
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

// ---------------------------------------------------------------------------
// HTTP + JSON-RPC
// ---------------------------------------------------------------------------
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

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
export function createHandler({ store, tz = 'Asia/Riyadh', currency = 'SAR' }) {
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
          const text = await callTool(params.name, params.arguments || {}, { store, hid, tz, currency })
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
