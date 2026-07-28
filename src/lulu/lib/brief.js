// Deterministic "AI-style" morning brief generator (offline, no network).
// When a real AI provider is configured later, swap this for an API call that
// returns the same shape. Keeps the UI identical either way.
import { isToday, isOverdue, daysUntil, money, greetingKey, expenseSar } from './format.js'

export function buildBrief({ tasks, expenses, vehicles, settings, lang }) {
  const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter(t => isToday(t.dueDate))
  const overdue = open.filter(t => isOverdue(t.dueDate))
  const waitingMe = open.filter(t => t.status === 'waiting_me')
  const critical = open.filter(t => t.priority === 'critical')
  const spentToday = expenses.filter(e => isToday(e.date)).reduce((s, e) => s + expenseSar(e, settings.rates), 0)

  const renewals = []
  vehicles.forEach(v => {
    const dd = daysUntil(v.policyExpiry)
    if (dd != null && dd <= 30) renewals.push({ v, dd })
  })

  const cur = settings.currency || 'SAR'
  const bits = []
  if (lang === 'ar') {
    if (dueToday.length) bits.push(`لديك ${dueToday.length} مهمة مستحقة اليوم`)
    if (overdue.length) bits.push(`و${overdue.length} متأخرة تحتاج انتباهك`)
    if (waitingMe.length) bits.push(`${waitingMe.length} بانتظار ردّك`)
    if (critical.length) bits.push(`أعلى أولوية: «${critical[0].title}»`)
    if (renewals.length) bits.push(`تجديد ${renewals[0].v.nickname || renewals[0].v.name} خلال ${renewals[0].dd} يوم`)
    if (spentToday) bits.push(`صرفت ${money(spentToday, cur, lang)} اليوم`)
    if (!bits.length) return 'يومك صافٍ. لا مهام عاجلة — استغل الهدوء في التخطيط.'
    return bits.join('، ') + '.'
  }
  if (dueToday.length) bits.push(`${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`)
  if (overdue.length) bits.push(`${overdue.length} overdue need${overdue.length > 1 ? '' : 's'} attention`)
  if (waitingMe.length) bits.push(`${waitingMe.length} waiting for your response`)
  if (critical.length) bits.push(`top priority: “${critical[0].title}”`)
  if (renewals.length) bits.push(`${renewals[0].v.nickname || renewals[0].v.name}'s renewal in ${renewals[0].dd}d`)
  if (spentToday) bits.push(`${money(spentToday, cur, lang)} spent so far`)
  if (!bits.length) return 'Your day is clear. No urgent tasks — a good window to plan ahead.'
  const sentence = bits.join(', ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}

export { greetingKey }
