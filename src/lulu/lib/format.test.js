import { describe, expect, test } from 'vitest'
import * as f from './format.js'

describe('currency conversion', () => {
  test('rateFor falls back to defaults and honours overrides', () => {
    expect(f.rateFor('SAR')).toBe(1)
    expect(f.rateFor('USD')).toBe(3.75)
    expect(f.rateFor('ZZZ')).toBe(1)          // unknown → 1
    expect(f.rateFor('USD', { USD: 4 })).toBe(4) // user override wins
  })
  test('toSar / expenseSar convert into the base currency', () => {
    expect(f.toSar(10, 'USD')).toBeCloseTo(37.5)
    expect(f.expenseSar({ amount: 2, currency: 'USD' })).toBeCloseTo(7.5)
    expect(f.expenseSar(null)).toBe(0)
  })
  test('money renders the amount with grouping and currency', () => {
    const s = f.money(1000, 'SAR', 'en')
    expect(s).toMatch(/1,000/)
    expect(s).toMatch(/SAR/)
    expect(f.money('not-a-number', 'SAR', 'en')).toMatch(/0/)
  })
})

describe('date formatting', () => {
  const d = new Date(2024, 2, 5) // local 5 March 2024 — tz-independent
  test('fmtDate honours the pattern', () => {
    expect(f.fmtDate(d, 'en', 'YYYY-MM-DD')).toBe('2024-03-05')
    expect(f.fmtDate(d, 'en', 'DD/MM/YYYY')).toBe('05/03/2024')
    expect(f.fmtDate(d, 'en', 'MM/DD/YYYY')).toBe('03/05/2024')
    expect(f.fmtDate('', 'en')).toBe('')
    expect(f.fmtDate('not-a-date', 'en')).toBe('')
  })
})

describe('relative date helpers', () => {
  const today = f.todayISO()
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  test('isToday / isOverdue', () => {
    expect(f.isToday(today)).toBe(true)
    expect(f.isToday(yesterday)).toBe(false)
    expect(f.isOverdue(yesterday)).toBe(true)
    expect(f.isOverdue(today)).toBe(false)
  })
  test('daysUntil', () => {
    expect(f.daysUntil(today)).toBe(0)
    expect(f.daysUntil(tomorrow)).toBe(1)
    expect(f.daysUntil(yesterday)).toBe(-1)
    expect(f.daysUntil('')).toBeNull()
  })
  test('relativeDay labels', () => {
    expect(f.relativeDay(today, 'en')).toBe('Today')
    expect(f.relativeDay(tomorrow, 'en')).toBe('Tomorrow')
    expect(f.relativeDay(yesterday, 'en')).toBe('Yesterday')
    expect(f.relativeDay(today, 'ar')).toBe('اليوم')
  })
})

describe('month helpers', () => {
  test('monthKey / isSameMonth', () => {
    expect(f.monthKey(new Date(2024, 2, 15))).toBe('2024-03')
    expect(f.isSameMonth(new Date(2024, 2, 1), new Date(2024, 2, 28))).toBe(true)
    expect(f.isSameMonth(new Date(2024, 1, 28), new Date(2024, 2, 1))).toBe(false)
  })
})
