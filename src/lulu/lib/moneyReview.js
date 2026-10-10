// "Review my month" — a plain-language summary of the month's spending, built
// deterministically (so it always works, offline, with no key) and optionally
// rewritten warmly by the user's Claude key. Mirrors the dayBrief pattern.
import { expenseSar, money } from './format.js'
import { catLabel } from './domain.js'
import { callClaude } from './ai.js'

const mKey = (d) => `${d.getFullYear()}-${d.getMonth()}`

export function buildMoneyReview({ expenses = [], settings = {}, now = new Date(), lang = 'en' } = {}) {
  const L = lang === 'ar'
  const cur = settings.currency || 'SAR'
  const rates = settings.rates
  const thisKey = mKey(now)
  const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastKey = mKey(lastD)
  const keyOf = (e) => { const d = new Date(e.date); return isNaN(d) ? '' : mKey(d) }
  const sum = (arr) => arr.reduce((s, e) => s + expenseSar(e, rates), 0)

  const thisExp = expenses.filter(e => keyOf(e) === thisKey)
  const lastExp = expenses.filter(e => keyOf(e) === lastKey)
  const total = sum(thisExp)
  const lastTotal = sum(lastExp)

  const byCat = {}; thisExp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, rates) })
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const byMer = {}; thisExp.forEach(e => { const m = (e.merchant || '').trim(); if (m) byMer[m] = (byMer[m] || 0) + expenseSar(e, rates) })
  const topMer = Object.entries(byMer).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const budget = Number(settings.monthlyBudget) || 0
  const monthName = now.toLocaleDateString(L ? 'ar' : 'en-US', { month: 'long' })

  const out = []
  out.push(`${monthName}: ${money(total, cur, lang)} ${L ? 'صُرف' : 'spent'}${thisExp.length ? ` (${thisExp.length} ${L ? 'عملية' : 'transactions'})` : ''}.`)
  if (budget > 0) {
    const rem = budget - total
    out.push(rem >= 0
      ? `${L ? 'المتبقي من الميزانية' : 'Budget left'}: ${money(rem, cur, lang)} ${L ? 'من' : 'of'} ${money(budget, cur, lang)}.`
      : `${L ? 'تجاوزت الميزانية بمقدار' : 'Over budget by'} ${money(-rem, cur, lang)}.`)
  }
  if (lastTotal > 0) {
    const diff = total - lastTotal
    const pct = Math.round(Math.abs(diff) / lastTotal * 100)
    out.push(`${pct}% ${diff >= 0 ? (L ? 'أكثر من الشهر الماضي' : 'more than last month') : (L ? 'أقل من الشهر الماضي' : 'less than last month')} (${money(lastTotal, cur, lang)}).`)
  }
  if (topCats.length) out.push(`${L ? 'أهم الفئات' : 'Top categories'}: ${topCats.map(([id, v]) => `${catLabel(id, lang)} ${money(v, cur, lang)}`).join(' · ')}.`)
  if (topMer.length) out.push(`${L ? 'أبرز المتاجر' : 'Top merchants'}: ${topMer.map(([m, v]) => `${m} ${money(v, cur, lang)}`).join(' · ')}.`)

  return { text: out.join('\n'), total, lastTotal, empty: thisExp.length === 0 }
}

// Rewrite the figures as a short, warm review via Claude. Returns null on any
// failure so the caller keeps the deterministic text.
export async function aiMoneyReview(summaryText, { apiKey, model, lang = 'en' } = {}) {
  if (!apiKey || !summaryText) return null
  const system = lang === 'ar'
    ? 'أنت مساعد مالي. اكتب ملخصًا ودّيًا موجزًا (٣-٤ جمل) لإنفاق الشهر اعتمادًا على الأرقام التالية، مع ملاحظة أو اقتراح عملي واحد. حافظ على كل الأرقام كما هي ولا تضف أرقامًا. أعد النص فقط.'
    : 'You are a financial assistant. Write a warm, concise 3–4 sentence review of the month\'s spending from the figures below, with one practical observation or tip. Keep every number exactly as given; do not invent figures. Return only the text.'
  try {
    const text = await callClaude({ apiKey, model, system, messages: [{ role: 'user', content: summaryText }], maxTokens: 400 })
    return (text && text.trim()) || null
  } catch { return null }
}
