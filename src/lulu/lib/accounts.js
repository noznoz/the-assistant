// Account balance math, all in SAR. An account's credits are the income tagged
// to it; its debits are the expenses tagged to it; remaining = opening balance
// + credits − debits. Net-income calculations can be limited to the accounts
// the user flagged as "include in net".
import { toSar, expenseSar } from './format.js'

export function accountStats(account, income = [], expenses = [], rates) {
  const name = account.name
  const opening = Number(account.openingBalance) || 0
  const credits = income.filter(i => i.account === name).reduce((s, i) => s + toSar(i.amount, i.currency || 'SAR', rates), 0)
  const debits = expenses.filter(e => e.account === name).reduce((s, e) => s + expenseSar(e, rates), 0)
  return { opening, credits, debits, remaining: opening + credits - debits }
}

// A transaction counts toward "net" when its account is flagged include-in-net,
// or when it has no account / an unknown account (treated as general).
export function isIncluded(accountName, accounts = []) {
  if (!accountName) return true
  const a = accounts.find(x => x.name === accountName)
  if (!a) return true
  return a.includeInNet !== false
}

export function defaultAccountName(accounts = []) {
  const d = accounts.find(a => a.isDefault) || accounts[0]
  return d ? d.name : ''
}
