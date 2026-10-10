import { describe, expect, test } from 'vitest'
import { buildMoneyReview } from './moneyReview.js'

const NOW = new Date(2026, 5, 15) // Jun 15 2026
const d = (y, m, day) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`

describe('buildMoneyReview', () => {
  const expenses = [
    // this month (June)
    { amount: '200', currency: 'SAR', category: 'food', merchant: 'Danube', date: d(2026, 6, 2) },
    { amount: '100', currency: 'SAR', category: 'food', merchant: 'Danube', date: d(2026, 6, 9) },
    { amount: '300', currency: 'SAR', category: 'fuel', merchant: 'Petromin', date: d(2026, 6, 10) },
    // last month (May)
    { amount: '500', currency: 'SAR', category: 'food', merchant: 'Tamimi', date: d(2026, 5, 20) },
  ]

  test('summarises total, top categories/merchants and month-over-month', () => {
    const r = buildMoneyReview({ expenses, settings: { currency: 'SAR', monthlyBudget: 1000 }, now: NOW, lang: 'en' })
    expect(r.empty).toBe(false)
    expect(r.total).toBe(600)
    expect(r.lastTotal).toBe(500)
    expect(r.text).toContain('3 transactions')
    expect(r.text).toContain('Budget left')
    expect(r.text).toContain('20% more than last month')
    expect(r.text).toContain('Danube')
    expect(r.text).toContain('Top categories')
  })

  test('empty month is flagged', () => {
    const r = buildMoneyReview({ expenses: [], settings: { currency: 'SAR' }, now: NOW })
    expect(r.empty).toBe(true)
  })
})
