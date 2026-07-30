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

export function totalLiabilities(expenses = [], rates) {
  return expenses.reduce((s, e) => s + installmentOutstanding(e, rates), 0)
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

export function netWorth({ accounts = [], investments = [], income = [], expenses = [], rates }) {
  const assets = totalAssets({ accounts, investments, income, expenses, rates })
  const liabilities = totalLiabilities(expenses, rates)
  return { assets: assets.total, accountsTotal: assets.accountsTotal, investTotal: assets.investTotal, liabilities, value: assets.total - liabilities }
}

export function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
