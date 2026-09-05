// "Start my day" — a full morning briefing built from the day's data. Returns
// plain text that reads well in the app, over WhatsApp, and in an email. The
// optional aiDayBrief() rewrites it warmly via the user's Claude key, falling
// back to this deterministic version on any failure.
import { isToday, isOverdue, money, expenseSar, fmtTime, fmtLongDate } from './format.js'
import { callClaude } from './ai.js'

const isTodayOrPast = (d) => { const t = new Date(d).getTime(); return !isNaN(t) && t <= endOfToday() }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime() }

export function buildDayBrief({ tasks = [], expenses = [], appointments = [], reminders = [], renewals = [], settings = {}, lang = 'en', prayer = null, name = '' }) {
  const L = lang === 'ar'
  const cur = settings.currency || 'SAR'
  const now = new Date()
  const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter(t => isToday(t.dueDate))
  const overdue = open.filter(t => isOverdue(t.dueDate))
  const waitingMe = open.filter(t => t.status === 'waiting_me')
  const highPri = open.filter(t => t.priority === 'critical' || t.priority === 'high')
  const todayAppts = appointments.filter(a => isToday(a.date)).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const todayRem = reminders.filter(r => !r.done && r.remindAt && isTodayOrPast(r.remindAt))
    .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt))
  const spentToday = expenses.filter(e => isToday(e.date)).reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const spentMonth = expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    .reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const budget = Number(settings.monthlyBudget) || 0

  const T = L ? {
    head: 'ملخص يومك', agenda: 'الأجندة', nothing: 'لا مواعيد اليوم', priorities: 'الأولويات',
    overdue: 'متأخرة', waiting: 'بانتظار ردّك', top: 'الأهم', money: 'المال', spentToday: 'صُرف اليوم',
    thisMonth: 'هذا الشهر', left: 'المتبقي من الميزانية', renewals: 'تجديدات قريبة', prayer: 'الصلاة القادمة',
    task: 'مهمة', tasksDue: 'مهام مستحقة اليوم', allClear: 'يومك صافٍ — نافذة جيدة للتخطيط.',
  } : {
    head: 'Your day', agenda: 'Agenda', nothing: 'Nothing scheduled today', priorities: 'Priorities',
    overdue: 'overdue', waiting: 'waiting for you', top: 'Top', money: 'Money', spentToday: 'Spent today',
    thisMonth: 'This month', left: 'Budget left', renewals: 'Renewals soon', prayer: 'Next prayer',
    task: 'task', tasksDue: 'due today', allClear: 'Your day is clear — a good window to plan ahead.',
  }

  const out = []
  out.push(`☀️ ${T.head}${name ? ` · ${name}` : ''} — ${fmtLongDate(now, lang)}`)

  // Agenda: timed items first (appointments + reminders), then due tasks.
  const agenda = []
  todayAppts.forEach(a => agenda.push(`   ${a.time || '—'}  ${a.title}`))
  todayRem.forEach(r => agenda.push(`   ${fmtTime(r.remindAt, lang)}  🔔 ${r.text}`))
  if (dueToday.length) agenda.push(`   • ${dueToday.length} ${T.tasksDue}: ${dueToday.slice(0, 3).map(x => x.title).join(', ')}${dueToday.length > 3 ? '…' : ''}`)
  out.push('', `🗓️ ${T.agenda}`, agenda.length ? agenda.join('\n') : `   ${T.nothing}`)

  // Priorities
  const pri = []
  if (overdue.length) pri.push(`   🔴 ${overdue.length} ${T.overdue}${overdue[0] ? ` — ${overdue[0].title}` : ''}`)
  if (waitingMe.length) pri.push(`   🟠 ${waitingMe.length} ${T.waiting}`)
  if (highPri.length) pri.push(`   ⭐ ${T.top}: ${highPri[0].title}`)
  if (pri.length) out.push('', `⚠️ ${T.priorities}`, pri.join('\n'))

  // Money
  const mon = [`   ${T.spentToday}: ${money(spentToday, cur, lang)}`, `   ${T.thisMonth}: ${money(spentMonth, cur, lang)}`]
  if (budget > 0) mon.push(`   ${T.left}: ${money(Math.max(0, budget - spentMonth), cur, lang)}`)
  out.push('', `💰 ${T.money}`, mon.join('\n'))

  // Renewals
  if (renewals.length) {
    out.push('', `🔄 ${T.renewals}`, renewals.slice(0, 4).map(r => `   • ${r.title} — ${r.days < 0 ? T.overdue : `${r.days}d`}`).join('\n'))
  }

  // Prayer
  if (prayer && prayer.name) out.push('', `🕌 ${T.prayer}: ${prayer.name} · ${prayer.time}`)

  if (!todayAppts.length && !todayRem.length && !dueToday.length && !overdue.length) {
    out.push('', T.allClear)
  }
  return out.join('\n')
}

// A one-line summary for a notification (the app icon / a push body has little
// room). Mirrored server-side by the send-reminders Edge Function so the 7:30
// daily push reads the same. Kept deliberately short.
export function briefSummary({ tasks = [], appointments = [], reminders = [], now = new Date(), lang = 'en' } = {}) {
  const today = now.toISOString().slice(0, 10)
  const dOnly = (d) => (typeof d === 'string' ? d.slice(0, 10) : '')
  const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const dueToday = open.filter(t => dOnly(t.dueDate) === today)
  const overdue = open.filter(t => { const d = dOnly(t.dueDate); return d && d < today })
  const appts = appointments.filter(a => dOnly(a.date) === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const rem = reminders.filter(r => !r.done && r.remindAt && dOnly(r.remindAt) <= today)
  const L = lang === 'ar'
  const parts = []
  if (dueToday.length) parts.push(L ? `${dueToday.length} مستحقة اليوم` : `${dueToday.length} due today`)
  if (overdue.length) parts.push(L ? `${overdue.length} متأخرة` : `${overdue.length} overdue`)
  if (appts.length) parts.push(`${appts[0].time ? appts[0].time + ' ' : ''}${appts[0].title}${appts.length > 1 ? ` +${appts.length - 1}` : ''}`)
  if (rem.length) parts.push(L ? `${rem.length} تذكير` : `${rem.length} reminder${rem.length > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : (L ? 'يومك صافٍ.' : 'Your day is clear.')
}

// Optional: rewrite the deterministic brief warmly via Claude. Returns null on
// any failure so the caller keeps the rule-based text.
export async function aiDayBrief(brief, { apiKey, model, lang = 'en' } = {}) {
  if (!apiKey || !brief) return null
  const system = lang === 'ar'
    ? 'أعد صياغة هذا الملخص الصباحي بأسلوب دافئ وموجز يخاطب المستخدم مباشرة. حافظ على كل الحقائق والأرقام والأوقات كما هي. لا تضف معلومات. أعِد النص فقط.'
    : 'Rewrite this morning brief as a warm, concise note addressed to the user. Keep every fact, number and time exactly. Do not invent anything. Return only the rewritten text.'
  try {
    const text = await callClaude({ apiKey, model, system, messages: [{ role: 'user', content: brief }], maxTokens: 600 })
    return (text && text.trim()) || null
  } catch { return null }
}
