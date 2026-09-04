// "Add anything" quick capture: turn one plain-language line into the right
// record — an expense, an appointment, a reminder, or a task — with the date,
// time and amount pulled out. Rule-based and offline; returns a { type, fields,
// label } plan the UI creates with the matching collection. Best-effort and
// conservative: when unsure it falls back to a plain task, so nothing is lost.
import { parseWhen } from './parseWhen.js'
import { buildReminderFields } from './reminders.js'

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

const pad = (n) => String(n).padStart(2, '0')

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

const dateOnly = (iso) => iso ? iso.slice(0, 10) : ''
const hhmm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const clean = (s) => (s || '').replace(/\s{2,}/g, ' ').replace(/^[-–,·]\s*/, '').replace(/\s+[-–,·]\s*$/, '').trim()

// Classify a captured line into a record plan. Priority: money → appointment →
// reminder (explicit "remind" or a clock time) → dated task → plain task.
export function classifyCapture(input, { currency = 'SAR', now = new Date() } = {}) {
  const raw = clean(input)
  if (!raw) return null
  const when = parseWhen(raw, now)
  const amount = parseAmount(raw, currency)

  // ---- Expense ----
  if (amount) {
    let item = raw.replace(amount.match, ' ').replace(SPEND_RE, ' ')
    const w = parseWhen(item, now)
    item = clean((w.text || item).replace(/\b(on|for|at)\b\s*$/i, ''))
    return {
      type: 'expense',
      label: `${amount.value.toLocaleString()} ${amount.currency}${item ? ' · ' + item : ''}`,
      fields: {
        amount: String(amount.value), currency: amount.currency, category: 'other',
        merchant: item, item, method: 'credit', classification: 'personal', kind: 'monthly',
        date: amount && when.at ? dateOnly(when.at) : now.toISOString().slice(0, 10),
      },
    }
  }

  // ---- Appointment ----
  if (APPT_RE.test(raw)) {
    const title = clean((when.text || raw))
    return {
      type: 'appointment',
      label: title + (when.at ? ` · ${dateOnly(when.at)}${when.hasTime ? ' ' + hhmm(when.at) : ''}` : ''),
      fields: { title, type: 'meeting', personId: '', location: '', note: '', date: dateOnly(when.at) || now.toISOString().slice(0, 10), time: when.hasTime ? hhmm(when.at) : '' },
    }
  }

  // ---- Reminder (explicit "remind" or an actual clock time) ----
  if (REMIND_RE.test(raw) || when.hasTime) {
    const text = clean((when.text || raw).replace(REMIND_RE, ''))
    const iso = when.at || (() => { const d = new Date(now.getTime() + 3600000); d.setSeconds(0, 0); return d.toISOString() })()
    return {
      type: 'reminder',
      label: `${text} · ${dateOnly(iso)}${when.hasTime || !when.at ? ' ' + hhmm(iso) : ''}`,
      fields: { ...buildReminderFields(text || raw, [iso]), repeat: 'none', done: false },
    }
  }

  // ---- Task (with a due date if a day was given) ----
  const title = clean(when.text || raw)
  return {
    type: 'task',
    label: title + (when.at ? ` · ${dateOnly(when.at)}` : ''),
    fields: { title, type: 'task', classification: 'personal', priority: 'medium', status: 'new', dueDate: dateOnly(when.at), description: '' },
  }
}
