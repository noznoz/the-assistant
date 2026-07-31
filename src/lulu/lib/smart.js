// Lightweight, on-device "smart" helpers over the expense history — no network.

const norm = (s) => String(s || '').trim().toLowerCase()
const monthKey = (d) => { const x = new Date(d); return isNaN(x) ? null : `${x.getFullYear()}-${x.getMonth()}` }

// Most-common category previously used for a given merchant.
export function suggestCategory(merchant, expenses = []) {
  const m = norm(merchant)
  if (m.length < 2) return null
  const counts = {}
  expenses.forEach(e => {
    if (norm(e.merchant) === m && e.category) counts[e.category] = (counts[e.category] || 0) + 1
  })
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : null
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Merchants that look like recurring charges: seen in 3+ distinct recent months
// with stable amounts, and not already tracked as a subscription.
export function detectRecurring(expenses = [], subscriptions = [], { minMonths = 3 } = {}) {
  const subNames = new Set(subscriptions.map(s => norm(s.name)))
  const now = new Date()
  const groups = {}
  expenses.forEach(e => {
    if (e.method === 'installment' || !e.merchant) return
    const mk = monthKey(e.date); if (!mk) return
    const monthsAgo = (now.getFullYear() - new Date(e.date).getFullYear()) * 12 + (now.getMonth() - new Date(e.date).getMonth())
    if (monthsAgo < 0 || monthsAgo > 6) return
    const key = norm(e.merchant)
    const g = (groups[key] = groups[key] || { merchant: e.merchant, months: new Set(), amounts: [], cats: {} })
    g.months.add(mk)
    g.amounts.push(Number(e.amount) || 0)
    if (e.category) g.cats[e.category] = (g.cats[e.category] || 0) + 1
  })
  const out = []
  Object.entries(groups).forEach(([key, g]) => {
    if (subNames.has(key)) return
    if (g.months.size < minMonths) return
    const med = median(g.amounts)
    if (med <= 0) return
    const stable = g.amounts.every(a => Math.abs(a - med) <= med * 0.25)
    if (!stable) return
    const cat = Object.entries(g.cats).sort((a, b) => b[1] - a[1])[0]
    out.push({ merchant: g.merchant, amount: Math.round(med), months: g.months.size, category: cat ? cat[0] : 'subscriptions' })
  })
  return out.sort((a, b) => b.months - a.months)
}
