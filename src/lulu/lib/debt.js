// Debt-payoff simulation. Each loan: { name, balance, monthlyPayment, rate (annual %) }.
// Strategy 'avalanche' targets the highest rate first; 'snowball' the smallest
// balance first. A constant monthly budget (sum of payments + extra) is applied:
// minimums to every loan, then whatever's left rolls onto the priority loan and,
// as loans clear, onto the next — the classic accelerate-and-roll method.

const MAXM = 1200

export function simulatePayoff(loansInput = [], strategy = 'avalanche', extra = 0) {
  const loans = loansInput
    .filter(l => (Number(l.balance) || 0) > 0)
    .map(l => ({ name: l.name, bal: Number(l.balance) || 0, rate: Number(l.rate) || 0, min: Number(l.monthlyPayment) || 0, paidMonth: null }))
  if (loans.length === 0) return { months: 0, totalInterest: 0, totalPaid: 0, order: [], feasible: true }

  const budget = loans.reduce((s, l) => s + l.min, 0) + (Number(extra) || 0)
  let month = 0, totalInterest = 0, totalPaid = 0

  const order = strategy === 'snowball'
    ? (a, b) => a.bal - b.bal
    : (a, b) => b.rate - a.rate

  while (loans.some(l => l.bal > 0.5) && month < MAXM) {
    month++
    loans.forEach(l => { if (l.bal > 0) { const i = l.bal * (l.rate / 100 / 12); l.bal += i; totalInterest += i } })
    const active = loans.filter(l => l.bal > 0).sort(order)
    let cash = budget
    // Minimums first, in priority order (so a loan can't hoard the whole budget).
    active.forEach(l => { const pay = Math.min(l.min, l.bal, cash); l.bal -= pay; cash -= pay; totalPaid += pay })
    // Roll the remainder onto the priority loans.
    for (const l of active) { if (cash <= 0.01) break; const pay = Math.min(l.bal, cash); l.bal -= pay; cash -= pay; totalPaid += pay }
    active.forEach(l => { if (l.bal <= 0.5 && l.paidMonth == null) l.paidMonth = month })
  }

  const feasible = loans.every(l => l.bal <= 0.5)
  return {
    months: feasible ? month : null,
    totalInterest,
    totalPaid,
    feasible,
    order: loans.map(l => ({ name: l.name, paidMonth: l.paidMonth })).sort((a, b) => (a.paidMonth ?? 9e9) - (b.paidMonth ?? 9e9)),
  }
}

export function payoffDate(months) {
  if (months == null) return null
  const d = new Date(); d.setMonth(d.getMonth() + months)
  return d
}
