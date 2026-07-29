// Builds the live notification feed derived from tasks, renewals, services,
// documents, subscriptions and birthdays. Shared by the Notifications screen
// (to display) and the Today bell (to count unread). Each item has a stable
// id so "seen" state can be tracked across renders.
import { isOverdue, isToday, daysUntil, fmtDate, relativeDay } from './format.js'

function daysToBirthday(bStr) {
  if (!bStr) return null
  const b = new Date(bStr); if (isNaN(b)) return null
  const today = new Date(new Date().toISOString().slice(0, 10))
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

export function buildNotificationFeed({ tasks = [], vehicles = [], services = [], docs = [], subs = [], people = [], t, lang = 'en', settings = {} }) {
  const out = []
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
  people.forEach(pn => { const dd = daysToBirthday(pn.birthday); if (dd != null && dd <= 14) out.push({ id: 'bd' + pn.id, tint: 't-brand', icon: 'cake', title: `${pn.name} — ${t('birthdaySoon')}`, meta: dd === 0 ? relativeDay(new Date().toISOString(), lang) : relativeDay(new Date(Date.now() + dd * 86400000).toISOString(), lang), go: 'people', sort: dd + 0.1 }) })
  return out.sort((a, b) => a.sort - b.sort)
}

// How many feed items have not yet been seen (ids not in settings.notificationsSeen).
export function unreadCount(feed, seen = []) {
  const set = new Set(seen || [])
  return feed.reduce((n, item) => n + (set.has(item.id) ? 0 : 1), 0)
}
