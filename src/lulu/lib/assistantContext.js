// ============================================================================
// Builds a compact, read-only snapshot of the user's data as plain text, so the
// in-app assistant can answer questions grounded in real data ("when does my
// insurance expire", "what's overdue", "how much did I spend this month").
//
// Deliberately excludes attachments/photos (they're huge data-URIs) and caps
// each list so the prompt stays small and cheap.
// ============================================================================

import { daysUntil } from './format.js'

const alive = (arr) => (arr || []).filter(r => r && !r.deletedAt)
const cap = (arr, n) => arr.slice(0, n)
const ym = (iso) => (iso || '').slice(0, 7)

export function buildAssistantContext(data, settings) {
  const L = []
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const thisMonth = todayISO.slice(0, 7)
  L.push(`Today: ${todayISO}.`)

  const p = settings.profile || {}
  const name = p.fullName || settings.name
  if (name) L.push(`User: ${name}${p.jobTitle ? `, ${p.jobTitle}` : ''}.`)
  L.push(`Currency: ${settings.currency}. Prayer city: ${settings.prayerCity || 'not set'}.`)

  // ---- Tasks (open) ----
  const tasks = alive(data.tasks).filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  if (tasks.length) {
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < todayISO)
    L.push(`\nOPEN TASKS: ${tasks.length} total, ${overdue.length} overdue.`)
    cap(tasks, 40).forEach(t => {
      const due = t.dueDate ? ` · due ${t.dueDate}${t.dueDate < todayISO ? ' (OVERDUE)' : ''}` : ''
      const who = t.assignedTo ? ` · assigned to ${t.assignedTo}` : ''
      const pr = t.priority ? ` · ${t.priority}` : ''
      L.push(`- ${t.title}${pr}${due}${who} [${t.status}]`)
    })
  }

  // ---- Documents & expiries ----
  const docs = alive(data.documents)
  if (docs.length) {
    L.push(`\nDOCUMENTS: ${docs.length}.`)
    const expiring = docs
      .filter(d => d.expiry)
      .map(d => ({ d, days: daysUntil(d.expiry) }))
      .filter(x => x.days != null && x.days <= 365)
      .sort((a, b) => a.days - b.days)
    if (expiring.length) {
      L.push('Expiring within a year:')
      cap(expiring, 25).forEach(({ d, days }) =>
        L.push(`- ${d.title}${d.category ? ` (${d.category})` : ''} · expires ${d.expiry} · in ${days} days`))
    }
  }

  // ---- Vehicles + accessories/services ----
  const vehicles = alive(data.vehicles)
  if (vehicles.length) {
    L.push(`\nVEHICLES: ${vehicles.length}.`)
    cap(vehicles, 12).forEach(v => {
      const title = v.name || v.nickname || [v.brand, v.model].filter(Boolean).join(' ') || 'Vehicle'
      const accs = alive(data.accessories).filter(a => a.vehicleId === v.id)
      const wishlist = accs.filter(a => a.status === 'wishlist').length
      L.push(`- ${title}${v.modelYear ? ` (${v.modelYear})` : ''}${accs.length ? ` · ${accs.length} accessories${wishlist ? `, ${wishlist} wishlist` : ''}` : ''}`)
    })
  }

  // ---- Finance snapshot ----
  const accounts = alive(data.accounts)
  if (accounts.length) {
    L.push(`\nACCOUNTS: ${accounts.map(a => a.name).filter(Boolean).join(', ')}.`)
  }
  const expenses = alive(data.expenses)
  if (expenses.length) {
    const monthSpend = expenses.filter(e => ym(e.date) === thisMonth).reduce((s, e) => s + (Number(e.amount) || 0), 0)
    L.push(`Spending this month (${thisMonth}): ${Math.round(monthSpend).toLocaleString()} ${settings.currency}.`)
    if (settings.monthlyBudget) L.push(`Monthly budget: ${settings.monthlyBudget} ${settings.currency}.`)
  }

  // ---- People & occasions ----
  const people = alive(data.people)
  if (people.length) {
    L.push(`\nPEOPLE: ${people.length}.`)
    const bdays = people
      .filter(x => x.birthday)
      .map(x => ({ x, days: daysUntil(nextAnnual(x.birthday)) }))
      .filter(x => x.days != null && x.days <= 60)
      .sort((a, b) => a.days - b.days)
    if (bdays.length) {
      L.push('Upcoming birthdays (60 days):')
      cap(bdays, 12).forEach(({ x, days }) => L.push(`- ${x.name} · in ${days} days`))
    }
  }

  // ---- Appointments ----
  const appts = alive(data.appointments).filter(a => a.date && a.date >= todayISO).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  if (appts.length) {
    L.push(`\nUPCOMING APPOINTMENTS:`)
    cap(appts, 12).forEach(a => L.push(`- ${a.title || 'Appointment'} · ${a.date}${a.time ? ` ${a.time}` : ''}`))
  }

  // ---- Trips ----
  const trips = alive(data.trips).filter(t => !t.end || t.end >= todayISO)
  if (trips.length) {
    L.push(`\nTRIPS:`)
    cap(trips, 8).forEach(t => L.push(`- ${t.name || t.destination} · ${t.start || '?'}–${t.end || '?'}`))
  }

  // ---- Properties ----
  const props = alive(data.properties)
  if (props.length) L.push(`\nPROPERTIES: ${cap(props, 10).map(x => x.name || x.title).filter(Boolean).join(', ')}.`)

  return L.join('\n')
}

// Next occurrence of a MM-DD anniversary from a birthday date string.
function nextAnnual(iso) {
  if (!iso) return null
  const now = new Date()
  const [, m, d] = iso.split('-')
  if (!m || !d) return null
  let year = now.getFullYear()
  const cand = `${year}-${m}-${d}`
  if (cand < now.toISOString().slice(0, 10)) year += 1
  return `${year}-${m}-${d}`
}
