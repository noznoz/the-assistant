// "Add anything" quick capture: turn one plain-language line into the right
// record — an expense, an appointment, a reminder, or a task — with the date,
// time and amount pulled out. Two paths that produce the same { type, fields,
// label } plan: classifyCapture() is rule-based, instant and offline;
// aiClassifyCapture() (optional) routes the text through the user's Claude key
// for fuzzier phrasing and falls back to the rules on any failure.
import { parseWhen } from './parseWhen.js'
import { buildReminderFields } from './reminders.js'
import { callClaude } from './ai.js'

const APPT_RE = /\b(meeting|appointments?|appt|call with|meet(?:ing)? with|lunch with|dinner with|coffee with|catch up with|interview|consultation)\b/i
const SPEND_RE = /\b(paid|spent|spend|bought|buy|cost|costs|pay|paying|purchased?)\b/i
const REMIND_RE = /\bremind(?:er)?\b/i

const CUR_WORD = {
  sar: 'SAR', sr: 'SAR', riyal: 'SAR', riyals: 'SAR',
  usd: 'USD', dollar: 'USD', dollars: 'USD',
  aed: 'AED', dirham: 'AED', dirhams: 'AED',
  eur: 'EUR', euro: 'EUR', euros: 'EUR',
  gbp: 'GBP', pound: 'GBP', pounds: 'GBP',
}
const CUR_SYM = { $: 'USD', '£': 'GBP', '€': 'EUR' }
const TYPES = ['expense', 'appointment', 'reminder', 'task']

const pad = (n) => String(n).padStart(2, '0')
const dateOnly = (iso) => iso ? iso.slice(0, 10) : ''
const hhmm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const clean = (s) => (s || '').replace(/\s{2,}/g, ' ').replace(/^\s*(for|on|at|to)\s+/i, '').replace(/^[-–,·]\s*/, '').replace(/\s+[-–,·]\s*$/, '').trim()

// Pull a money amount out of the text. Requires a currency marker OR a spend
// verb, so a bare number ("call 3 people") is never treated as money.
export function parseAmount(input, defaultCurrency = 'SAR') {
  const re = /([$£€])?\s*(?:\b(sar|sr|usd|aed|eur|gbp|riyals?|dollars?|dirhams?|euros?|pounds?)\b\s*)?(\d[\d,]*(?:\.\d+)?)\s*(?:([$£€])|\b(sar|sr|usd|aed|eur|gbp|riyals?|dollars?|dirhams?|euros?|pounds?)\b)?/i
  const m = input.match(re)
  if (!m) return null
  const value = parseFloat(m[3].replace(/,/g, ''))
  if (!isFinite(value)) return null
  const symTok = m[1] || m[4]
  const wordTok = (m[2] || m[5] || '').toLowerCase().replace(/s$/, '')
  const currency = (symTok && CUR_SYM[symTok]) || CUR_WORD[wordTok] || null
  if (!currency && !SPEND_RE.test(input)) return null // just a number, not money
  return { value, currency: currency || defaultCurrency, match: m[0].trim() }
}

// Combine a YYYY-MM-DD + HH:MM into an ISO timestamp, with sensible defaults:
// date-only → 09:00; time-only → today (or tomorrow if already past); neither →
// one hour from now.
function combineISO(date, time, now) {
  if (!date && !time) { const d = new Date(now.getTime() + 3600000); d.setSeconds(0, 0); return d.toISOString() }
  const d = date ? new Date(`${date}T00:00:00`) : new Date(now)
  if (time) { const [h, m] = time.split(':'); d.setHours(+h, +m, 0, 0) } else { d.setHours(9, 0, 0, 0) }
  if (!date && d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

// Build the record plan from a normalised { type, title, amount, currency,
// date, time }. Shared by both the rule-based and AI paths so field shapes and
// labels never diverge.
function makePlan(n, { currency = 'SAR', now = new Date() } = {}) {
  const today = now.toISOString().slice(0, 10)
  const type = TYPES.includes(n.type) ? n.type : 'task'
  const title = clean(n.title || '')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? n.date : ''
  const time = /^\d{1,2}:\d{2}$/.test(n.time || '') ? n.time.replace(/^(\d):/, '0$1:') : ''

  if (type === 'expense') {
    const amt = Number(n.amount)
    const value = isFinite(amt) && amt > 0 ? amt : 0
    const cur = n.currency || currency
    return {
      type, label: `${value.toLocaleString()} ${cur}${title ? ' · ' + title : ''}`,
      fields: { amount: String(value), currency: cur, category: 'other', merchant: title, item: title, method: 'credit', classification: 'personal', kind: 'monthly', date: date || today },
    }
  }
  if (type === 'appointment') {
    return {
      type, label: title + (date ? ` · ${date}${time ? ' ' + time : ''}` : ''),
      fields: { title, type: 'meeting', personId: '', location: '', note: '', date: date || today, time },
    }
  }
  if (type === 'reminder') {
    const iso = combineISO(date, time, now)
    return {
      type, label: `${title} · ${dateOnly(iso)} ${hhmm(iso)}`,
      fields: { ...buildReminderFields(title || (n.title || '').trim(), [iso]), repeat: 'none', done: false },
    }
  }
  return {
    type: 'task', label: title + (date ? ` · ${date}` : ''),
    fields: { title, type: 'task', classification: 'personal', priority: 'medium', status: 'new', dueDate: date, description: '' },
  }
}

// Rule-based classification. Priority: money → appointment → reminder (explicit
// "remind" or a clock time) → dated task → plain task.
export function classifyCapture(input, { currency = 'SAR', now = new Date() } = {}) {
  const raw = clean(input)
  if (!raw) return null
  const when = parseWhen(raw, now)
  const amount = parseAmount(raw, currency)

  if (amount) {
    const stripped = raw.replace(amount.match, ' ').replace(SPEND_RE, ' ')
    const w = parseWhen(stripped, now)
    return makePlan({ type: 'expense', title: clean(w.text || stripped), amount: amount.value, currency: amount.currency, date: dateOnly(when.at) }, { currency, now })
  }
  if (APPT_RE.test(raw)) {
    return makePlan({ type: 'appointment', title: clean(when.text || raw), date: dateOnly(when.at), time: when.hasTime ? hhmm(when.at) : '' }, { currency, now })
  }
  if (REMIND_RE.test(raw) || when.hasTime) {
    return makePlan({ type: 'reminder', title: clean((when.text || raw).replace(REMIND_RE, '')), date: dateOnly(when.at), time: when.hasTime ? hhmm(when.at) : '' }, { currency, now })
  }
  return makePlan({ type: 'task', title: clean(when.text || raw), date: dateOnly(when.at) }, { currency, now })
}

// Optional AI path: ask Claude to normalise the line, then build the same plan.
// Returns null on any failure (no key, network error, bad JSON) so the caller
// can fall back to classifyCapture().
export async function aiClassifyCapture(input, { apiKey, model, currency = 'SAR', now = new Date() } = {}) {
  const raw = (input || '').trim()
  if (!apiKey || !raw) return null
  const today = now.toISOString().slice(0, 10)
  const system =
    `Turn a short note into ONE structured record for a personal-assistant app. ` +
    `Today is ${today} (${now.toDateString()}); default currency ${currency}. ` +
    `Reply with ONLY a JSON object (no prose, no code fence) with keys: ` +
    `type ("expense"|"appointment"|"reminder"|"task"), title (string — the description with date/amount words removed), ` +
    `amount (number or null), currency (3-letter code or null), date ("YYYY-MM-DD" or null), time ("HH:MM" 24-hour or null). ` +
    `Rules: money mentioned → expense; meeting/appointment with a person or place → appointment; a timed personal nudge → reminder; otherwise task. ` +
    `Resolve relative dates (today, tomorrow, next friday) against today.`
  let text
  try {
    text = await callClaude({ apiKey, model, system, messages: [{ role: 'user', content: raw }], maxTokens: 300 })
  } catch { return null }
  let obj
  try { obj = JSON.parse(String(text).replace(/```json|```/g, '').trim()) } catch { return null }
  if (!obj || !TYPES.includes(obj.type)) return null
  return makePlan(obj, { currency, now })
}
