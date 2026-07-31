// Cashflow projection, all in SAR. Starts from today's includable account
// balances, then rolls forward using a transparent monthly run-rate:
//   net monthly = recurring income − loan payments − subscriptions − avg spend
// where "avg spend" is the mean of the last 3 months of non-installment expenses.
import { toSar, expenseSar } from './format.js'
import { accountStats, isIncluded } from './accounts.js'

function monthsSince(dateStr) {
  const d = new Date(dateStr); if (isNaN(d)) return 0
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

// Monthly amount still being paid on an active installment expense.
function installmentMonthly(e, rates) {
  if (!e || e.method !== 'installment') return 0
  const months = Number(e.installmentMonths) || 0
  if (months <= 0 || monthsSince(e.date) >= months) return 0
  return expenseSar(e, rates) / months
}

function subMonthly(s, rates) {
  if (s.active === false) return 0
  const amt = toSar(s.amount, s.currency || 'SAR', rates)
  return s.cycle === 'yearly' ? amt / 12 : s.cycle === 'weekly' ? amt * 4.33 : amt
}

export function buildForecast({ accounts = [], income = [], expenses = [], subscriptions = [], liabilities = [], rates } = {}) {
  const balance = accounts
    .filter(a => isIncluded(a.name, accounts))
    .reduce((s, a) => s + accountStats(a, income, expenses, rates).remaining, 0)

  const monthlyIncome = income
    .filter(i => i.recurring)
    .reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)

  const loanPayments = liabilities.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)
  const subs = subscriptions.reduce((s, x) => s + subMonthly(x, rates), 0)
  const installments = expenses.reduce((s, e) => s + installmentMonthly(e, rates), 0)

  // Average discretionary spend over the last 3 full months (exclude installments,
  // counted above). Falls back to this month if there is no history yet.
  const now = new Date()
  const buckets = {}
  expenses.forEach(e => {
    if (e.method === 'installment') return
    const d = new Date(e.date); if (isNaN(d)) return
    const ms = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (ms >= 0 && ms <= 2) buckets[ms] = (buckets[ms] || 0) + expenseSar(e, rates)
  })
  const months = Object.keys(buckets).length || 1
  const avgSpend = Object.values(buckets).reduce((s, v) => s + v, 0) / months

  const commitments = loanPayments + subs + installments
  const netMonthly = monthlyIncome - commitments - avgSpend

  const projections = [30, 60, 90].map(days => ({
    days, value: balance + netMonthly * (days / 30),
  }))

  return { balance, monthlyIncome, loanPayments, subs, installments, commitments, avgSpend, netMonthly, projections }
}
