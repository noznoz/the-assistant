// Builds the live notification feed derived from tasks, renewals, services,
// documents, subscriptions and birthdays. Shared by the Notifications screen
// (to display) and the Today bell (to count unread). Each item has a stable
// id so "seen" state can be tracked across renders.
import { isOverdue, isToday, daysUntil, fmtDate, fmtTime, relativeDay } from './format.js'

function daysToBirthday(bStr) {
  if (!bStr) return null
  const b = new Date(bStr); if (isNaN(b)) return null
  const today = new Date(new Date().toISOString().slice(0, 10))
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

function monthsElapsed(dateStr) {
  const d = new Date(dateStr); if (isNaN(d)) return 0
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

// Identity documents (Saudi context) surfaced when they expire within ~60 days.
const PERSON_DOC_FIELDS = [
  { field: 'iqamaExpiry', key: 'iqama' },
  { field: 'passportExpiry', key: 'passport' },
  { field: 'licenseExpiry', key: 'drivingLicense' },
  { field: 'nationalIdExpiry', key: 'nationalId' },
]

function sumMonth(expenses, ref, rates) {
  const rk = `${ref.getFullYear()}-${ref.getMonth()}`
  return expenses.reduce((s, e) => {
    const d = new Date(e.date)
    if (isNaN(d) || `${d.getFullYear()}-${d.getMonth()}` !== rk) return s
    return s + (Number(e.amount) || 0) * ((rates && rates[e.currency || 'SAR']) || 1)
  }, 0)
}

export function buildNotificationFeed({ tasks = [], vehicles = [], services = [], docs = [], subs = [], people = [], expenses = [], valuables = [], appointments = [], reminders = [], t, lang = 'en', settings = {} }) {
  const out = []
  // Reminders: anything due now (past & not done) or coming up within 7 days.
  const nowMs = Date.now()
  reminders.forEach(r => {
    if (r.done || !r.remindAt) return
    const ts = new Date(r.remindAt).getTime()
    if (isNaN(ts)) return
    const diffDays = (ts - nowMs) / 86400000
    if (diffDays > 7) return
    const due = ts <= nowMs
    out.push({ id: 'rem' + r.id, tint: due ? 't-danger' : diffDays <= 1 ? 't-warn' : 't-info', icon: 'bell', title: r.text, meta: due ? t('reminderDue') : `${relativeDay(r.remindAt, lang)} · ${fmtTime(r.remindAt, lang)}`, go: 'reminders', sort: due ? -2 : diffDays - 0.1 })
  })
  // Upcoming appointments within the next 7 days.
  appointments.forEach(a => { const dd = daysUntil(a.date); if (dd != null && dd >= 0 && dd <= 7) { const who = (people.find(p => p.id === a.personId) || {}).name; out.push({ id: 'appt' + a.id, tint: dd <= 1 ? 't-warn' : 't-info', icon: 'calendar', title: a.title + (who ? ` · ${who}` : ''), meta: `${relativeDay(a.date, lang)}${a.time ? ' · ' + a.time : ''}`, go: 'appointments', sort: dd - 0.15 }) } })
  const open = tasks.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
  open.filter(x => isOverdue(x.dueDate)).forEach(x => out.push({ id: 't' + x.id, tint: 't-danger', icon: 'clock', title: x.title, meta: t('overdue'), go: 'tasks/overdue', sort: -1 }))
  open.filter(x => isToday(x.dueDate)).forEach(x => out.push({ id: 'd' + x.id, tint: 't-info', icon: 'today', title: x.title, meta: t('todaysTasks'), go: 'tasks/today', sort: 0 }))
  open.filter(x => x.status === 'waiting_me').forEach(x => out.push({ id: 'w' + x.id, tint: 't-warn', icon: 'flag', title: x.title, meta: t('waitingForMe'), go: 'tasks/waiting_me', sort: 1 }))
  open.filter(x => (x.assigneeId || x.assignedTo) && (isOverdue(x.dueDate) || isToday(x.dueDate) || x.status === 'waiting_someone'))
    .forEach(x => out.push({ id: 'a' + x.id, tint: isOverdue(x.dueDate) ? 't-danger' : 't-warn', icon: 'people', title: x.title, meta: `${t('waitingOn')} ${x.assignedTo || ''}`.trim(), go: 'tasks/delegated', sort: isOverdue(x.dueDate) ? -0.5 : 1.5 }))
  vehicles.forEach(v => { const dd = daysUntil(v.policyExpiry); if (dd != null && dd <= 45) out.push({ id: 'v' + v.id, tint: dd <= 14 ? 't-danger' : 't-warn', icon: 'shield', title: `${v.nickname || v.name} — ${t('insurance')}`, meta: `${t('policyExpiry')}: ${fmtDate(v.policyExpiry, lang, settings.dateFormat)}`, go: `garage/${v.id}`, sort: dd }) })
  services.forEach(s => { const dd = daysUntil(s.nextDate); if (dd != null && dd <= 30) { const v = vehicles.find(x => x.id === s.vehicleId); out.push({ id: 'svc' + s.id, tint: dd <= 7 ? 't-danger' : 't-warn', icon: 'wrench', title: `${v ? (v.nickname || v.name) : ''} — ${t('serviceDue')}`, meta: `${s.work} · ${fmtDate(s.nextDate, lang, settings.dateFormat)}`, go: v ? `garage/${v.id}` : 'garage', sort: dd }) } })
  docs.forEach(d => { const dd = daysUntil(d.expiry); if (dd != null && dd <= 30) out.push({ id: 'doc' + d.id, tint: dd <= 7 ? 't-danger' : 't-warn', icon: 'doc', title: d.title, meta: `${t('policyExpiry')}: ${relativeDay(d.expiry, lang)}`, go: 'documents', sort: dd }) })
  subs.filter(s => s.active !== false).forEach(s => { const dd = daysUntil(s.nextDue); if (dd != null && dd <= 5) out.push({ id: 'sub' + s.id, tint: dd <= 1 ? 't-danger' : 't-warn', icon: 'wallet', title: s.name, meta: `${t('nextDue')}: ${relativeDay(s.nextDue, lang)}`, go: 'subscriptions', sort: dd }) })
  // Upcoming installment payments (next monthly instalment within a week).
  expenses.filter(e => e.method === 'installment' && Number(e.installmentMonths) > 0).forEach(e => {
    const months = Number(e.installmentMonths)
    const paid = Math.max(0, monthsElapsed(e.date))
    if (paid >= months) return
    const d0 = new Date(e.date); if (isNaN(d0)) return
    const next = new Date(d0.getFullYear(), d0.getMonth() + paid + 1, d0.getDate())
    const dd = daysUntil(next.toISOString().slice(0, 10))
    if (dd != null && dd >= 0 && dd <= 7) out.push({ id: 'inst' + e.id, tint: dd <= 2 ? 't-warn' : 't-info', icon: 'refresh', title: `${e.item || e.merchant || t('installment')} · ${paid + 1}/${months}`, meta: `${t('installment')}: ${relativeDay(next.toISOString(), lang)}`, go: 'moneycal', sort: dd + 0.05 })
  })
  people.forEach(pn => { const dd = daysToBirthday(pn.birthday); if (dd != null && dd <= 14) out.push({ id: 'bd' + pn.id, tint: 't-brand', icon: 'cake', title: `${pn.name} — ${t('birthdaySoon')}`, meta: dd === 0 ? relativeDay(new Date().toISOString(), lang) : relativeDay(new Date(Date.now() + dd * 86400000).toISOString(), lang), go: 'people', sort: dd + 0.1 }) })
  valuables.forEach(v => { const dd = daysUntil(v.warrantyExpiry); if (dd != null && dd >= 0 && dd <= 30) out.push({ id: 'war' + v.id, tint: dd <= 7 ? 't-warn' : 't-info', icon: 'gift', title: `${v.name} — ${t('warranty')}`, meta: `${t('warranty')}: ${relativeDay(v.warrantyExpiry, lang)}`, go: 'valuables', sort: dd + 0.2 }) })
  // Identity-document renewals (Iqama, passport, license, national ID) within 60 days.
  people.forEach(pn => PERSON_DOC_FIELDS.forEach(df => { const dd = daysUntil(pn[df.field]); if (dd != null && dd <= 60) out.push({ id: df.field + pn.id, tint: dd < 0 ? 't-danger' : dd <= 21 ? 't-warn' : 't-info', icon: 'shield', title: `${pn.name} — ${t(df.key)}`, meta: dd < 0 ? t('expired') : `${t('renews')}: ${relativeDay(pn[df.field], lang)}`, go: 'renewals', sort: dd - 0.3 }) }))
  // Spending insight: this month vs last month (only once meaningful spend exists).
  const now = new Date()
  const thisM = sumMonth(expenses, now, settings.rates)
  const lastM = sumMonth(expenses, new Date(now.getFullYear(), now.getMonth() - 1, 1), settings.rates)
  if (lastM > 500 && thisM > 0) {
    const pct = Math.round((thisM - lastM) / lastM * 100)
    if (Math.abs(pct) >= 15) out.push({ id: 'insight-spend-' + now.getMonth(), tint: pct > 0 ? 't-warn' : 't-ok', icon: 'chart', title: pct > 0 ? t('spendingUp') : t('spendingDown'), meta: `${pct > 0 ? '+' : ''}${pct}% ${t('vsLastMonth')}`, go: 'trends', sort: 50 })
  }
  return out.sort((a, b) => a.sort - b.sort)
}

// How many feed items have not yet been seen (ids not in settings.notificationsSeen).
export function unreadCount(feed, seen = []) {
  const set = new Set(seen || [])
  return feed.reduce((n, item) => n + (set.has(item.id) ? 0 : 1), 0)
}
