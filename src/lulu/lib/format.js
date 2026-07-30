// Formatting helpers — currency (SAR default), dates, times, relative dates.
// All date math is naive-local; timezone is a display preference for now and
// the architecture leaves room for full Asia/Riyadh conversion later.

// Exchange rates expressed as "SAR per 1 unit of currency" (base = SAR).
// SAR is pegged to USD at 3.75; the rest are sensible, user-editable defaults.
export const DEFAULT_RATES = {
  SAR: 1, USD: 3.75, EUR: 4.05, GBP: 4.75, AED: 1.02,
  KWD: 12.2, BHD: 9.95, QAR: 1.03, OMR: 9.74,
}

export function rateFor(currency, rates) {
  const r = (rates || {})[currency]
  return Number(r != null ? r : (DEFAULT_RATES[currency] != null ? DEFAULT_RATES[currency] : 1)) || 1
}

// Convert an amount in `currency` to SAR.
export function toSar(amount, currency = 'SAR', rates) {
  return (Number(amount) || 0) * rateFor(currency, rates)
}

// SAR value of an expense (or any {amount,currency}) using the given rates.
export function expenseSar(e, rates) {
  if (!e) return 0
  return toSar(e.amount, e.currency || 'SAR', rates)
}

export function money(amount, currency = 'SAR', lang = 'en') {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString()}`
  }
}

export function todayISO() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10)
}

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']

export function fmtDate(value, lang = 'en', fmt = 'DD MMM YYYY') {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d)) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const mon = (lang === 'ar' ? MONTHS_AR : MONTHS_EN)[d.getMonth()]
  const yyyy = d.getFullYear()
  switch (fmt) {
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`
    default: return `${dd} ${mon} ${yyyy}`
  }
}

export function fmtLongDate(value, lang = 'en') {
  const d = new Date(value)
  const day = (lang === 'ar' ? DAYS_AR : DAYS_EN)[d.getDay()]
  const mon = (lang === 'ar' ? MONTHS_AR : MONTHS_EN)[d.getMonth()]
  return `${day}, ${d.getDate()} ${mon} ${d.getFullYear()}`
}

export function fmtTime(value, lang = 'en') {
  if (!value) return ''
  // value can be "HH:MM" or ISO
  let h, m
  if (/^\d{1,2}:\d{2}$/.test(value)) { [h, m] = value.split(':').map(Number) }
  else { const d = new Date(value); h = d.getHours(); m = d.getMinutes() }
  const am = h < 12
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mer = lang === 'ar' ? (am ? 'ص' : 'م') : (am ? 'AM' : 'PM')
  return `${h12}:${String(m).padStart(2, '0')} ${mer}`
}

export function relativeDay(value, lang = 'en') {
  if (!value) return ''
  const target = new Date(isoDate(value))
  const now = new Date(todayISO())
  const diff = Math.round((target - now) / 86400000)
  if (diff === 0) return lang === 'ar' ? 'اليوم' : 'Today'
  if (diff === 1) return lang === 'ar' ? 'غداً' : 'Tomorrow'
  if (diff === -1) return lang === 'ar' ? 'أمس' : 'Yesterday'
  if (diff < 0) return lang === 'ar' ? `متأخر ${Math.abs(diff)} يوم` : `${Math.abs(diff)}d overdue`
  if (diff < 7) return lang === 'ar' ? `خلال ${diff} أيام` : `In ${diff}d`
  return fmtDate(value, lang)
}

export function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'goodMorning'
  if (h < 18) return 'goodAfternoon'
  return 'goodEvening'
}

export function isToday(value) {
  return value && isoDate(value) === todayISO()
}
export function isOverdue(value) {
  return value && isoDate(value) < todayISO()
}
export function daysUntil(value) {
  if (!value) return null
  return Math.round((new Date(isoDate(value)) - new Date(todayISO())) / 86400000)
}
export function monthKey(value = new Date()) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function isSameMonth(value, ref = new Date()) {
  return monthKey(value) === monthKey(ref)
}
