// Sharing via the native OS share sheet (incl. WhatsApp) with a WhatsApp
// deep-link fallback. Plus professional formatters for each shareable entity.
import { STRINGS } from '../i18n/strings.js'
import { money, fmtDate, fmtLongDate, relativeDay } from './format.js'
import { findStatus, findPriority, findCategory, findVehicleType, label } from './domain.js'

export async function share(text, title = 'The Assistant') {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return }
    catch (e) { if (e && e.name === 'AbortError') return }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

export function shareToWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

const t = (lang, k) => STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k

// ---- Task ----
export function formatTask(task, lang = 'en', settings = {}) {
  const st = findStatus(task.status)
  const pr = findPriority(task.priority)
  const lines = [`📋 *${task.title}*`]
  if (task.description) lines.push(task.description)
  const meta = []
  if (pr) meta.push(`${lang === 'ar' ? 'الأولوية' : 'Priority'}: ${t(lang, pr.key)}`)
  if (st) meta.push(`${lang === 'ar' ? 'الحالة' : 'Status'}: ${t(lang, st.key)}`)
  if (task.dueDate) meta.push(`${t(lang, 'dueDate')}: ${fmtDate(task.dueDate, lang, settings.dateFormat)}`)
  if (task.assignedTo) meta.push(`${t(lang, 'assignedTo')}: ${task.assignedTo}`)
  if (meta.length) lines.push('', ...meta.map(m => `• ${m}`))
  lines.push('', '— The Assistant')
  return lines.join('\n')
}

// AI-style professional follow-up message (deterministic template; no network).
export function formatFollowUp(task, lang = 'en', settings = {}) {
  const name = task.assignedTo || task.requestedBy || (lang === 'ar' ? 'حضرتك' : 'there')
  if (lang === 'ar') {
    return [
      `السلام عليكم ${name}،`, '',
      `أردت المتابعة بخصوص: *${task.title}*.`,
      task.dueDate ? `الموعد المستهدف: ${fmtDate(task.dueDate, lang, settings.dateFormat)}.` : '',
      'أقدّر تحديثاً بسيطاً عن آخر المستجدات متى ما تيسّر.', '',
      'شكراً لك.',
    ].filter(Boolean).join('\n')
  }
  return [
    `Hi ${name},`, '',
    `Following up on: *${task.title}*.`,
    task.dueDate ? `Target date: ${fmtDate(task.dueDate, lang, settings.dateFormat)}.` : '',
    'Could you share a quick update when you have a moment?', '',
    'Thank you.',
  ].filter(Boolean).join('\n')
}

// ---- Daily agenda ----
export function formatAgenda(tasks, expenses, lang = 'en', settings = {}) {
  const cur = settings.currency || 'SAR'
  const head = `🗓️ *${fmtLongDate(new Date(), lang)}*`
  const open = tasks.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
  const lines = [head, '']
  if (open.length) {
    lines.push(`*${t(lang, 'todaysTasks')}*`)
    open.slice(0, 12).forEach(x => {
      const pr = findPriority(x.priority)
      const flag = pr && (pr.id === 'critical' || pr.id === 'high') ? '🔴 ' : '• '
      lines.push(`${flag}${x.title}${x.dueDate ? ` — ${relativeDay(x.dueDate, lang)}` : ''}`)
    })
    lines.push('')
  } else {
    lines.push(t(lang, 'noThingsToday'), '')
  }
  const spent = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  if (expenses.length) lines.push(`💳 ${t(lang, 'todaysSpending')}: ${money(spent, cur, lang)}`, '')
  lines.push('— The Assistant')
  return lines.join('\n')
}

// ---- Expense summary ----
export function formatExpenseSummary(expenses, lang = 'en', settings = {}) {
  const cur = settings.currency || 'SAR'
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const byCat = {}
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0) })
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const lines = [`💳 *${t(lang, 'expenses')}*`, `${lang === 'ar' ? 'الإجمالي' : 'Total'}: *${money(total, cur, lang)}*`, '']
  top.forEach(([cat, amt]) => {
    lines.push(`• ${label(findCategory(cat), lang) || cat}: ${money(amt, cur, lang)}`)
  })
  lines.push('', '— The Assistant')
  return lines.join('\n')
}

// ---- Garage profile ----
export function formatVehicle(v, lang = 'en', settings = {}) {
  const cur = settings.currency || 'SAR'
  const vt = findVehicleType(v.type)
  const lines = [`🚗 *${v.name || v.model}*`]
  if (v.nickname) lines.push(`"${v.nickname}"`)
  lines.push('')
  const facts = [
    [t(lang, 'vehicleType'), vt ? t(lang, vt.key) : ''],
    [t(lang, 'brand'), v.brand],
    [t(lang, 'model'), v.model],
    [t(lang, 'modelYear'), v.year],
    [t(lang, 'color'), v.color],
    [t(lang, 'plate'), v.plate],
    [v.type === 'boat' ? t(lang, 'engineHours') : t(lang, 'mileage'), v.mileage],
  ].filter(([, val]) => val)
  facts.forEach(([k, val]) => lines.push(`• ${k}: ${val}`))
  if (v.currentValue) lines.push(`• ${t(lang, 'currentValue')}: ${money(v.currentValue, cur, lang)}`)
  if (v.bio) lines.push('', v.bio)
  lines.push('', '— The Assistant')
  return lines.join('\n')
}
