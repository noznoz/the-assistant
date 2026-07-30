// Net-worth & liability math, all in SAR.
import { toSar, expenseSar } from './format.js'
import { accountStats } from './accounts.js'

function monthsSince(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return 0
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

// Outstanding balance still owed on an installment expense.
export function installmentOutstanding(e, rates) {
  if (!e || e.method !== 'installment') return 0
  const months = Number(e.installmentMonths) || 0
  if (months <= 0) return 0
  const total = expenseSar(e, rates)
  const monthly = total / months
  const paid = Math.min(months, Math.max(0, monthsSince(e.date))) * monthly
  return Math.max(0, total - paid)
}

// Total owed: outstanding installment balances + tracked loan/liability balances.
export function totalLiabilities(expenses = [], rates, liabilities = []) {
  const inst = expenses.reduce((s, e) => s + installmentOutstanding(e, rates), 0)
  const loans = liabilities.reduce((s, l) => s + (Number(l.balance) || 0), 0)
  return inst + loans
}

export function investmentValue(v, rates) {
  return toSar(v.currentValue || v.invested, v.currency || 'SAR', rates)
}

// Assets = account remaining balances + investment portfolio value.
export function totalAssets({ accounts = [], investments = [], income = [], expenses = [], rates }) {
  const accountsTotal = accounts.reduce((s, a) => s + accountStats(a, income, expenses, rates).remaining, 0)
  const investTotal = investments.reduce((s, v) => s + investmentValue(v, rates), 0)
  return { accountsTotal, investTotal, total: accountsTotal + investTotal }
}

export function netWorth({ accounts = [], investments = [], income = [], expenses = [], liabilities = [], rates }) {
  const assets = totalAssets({ accounts, investments, income, expenses, rates })
  const debt = totalLiabilities(expenses, rates, liabilities)
  return { assets: assets.total, accountsTotal: assets.accountsTotal, investTotal: assets.investTotal, liabilities: debt, value: assets.total - debt }
}

export function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
