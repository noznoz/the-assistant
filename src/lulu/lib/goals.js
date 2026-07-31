// Savings-goal math. Amounts are stored in each goal's own currency; the screen
// converts to the display currency where it needs a shared total.
import { daysUntil } from './format.js'

export function monthsUntil(dateStr) {
  const dd = daysUntil(dateStr)
  if (dd == null) return null
  return Math.max(0, dd / 30.44)
}

// Progress + the monthly contribution needed to hit the target by its date.
export function goalStats(goal) {
  const target = Number(goal.target) || 0
  const saved = Number(goal.saved) || 0
  const remaining = Math.max(0, target - saved)
  const pct = target > 0 ? Math.min(1, saved / target) : 0
  const months = monthsUntil(goal.targetDate)
  const monthlyNeeded = remaining > 0 && months != null
    ? (months < 1 ? remaining : remaining / months)
    : 0
  const done = target > 0 && saved >= target
  return { target, saved, remaining, pct, months, monthlyNeeded, done }
}
