import { describe, expect, test } from 'vitest'
import { classifyCapture, parseAmount } from './parseCapture.js'

const NOW = new Date(2026, 0, 14, 10, 0, 0, 0) // Wed 14 Jan 2026, 10:00
const c = (s) => classifyCapture(s, { currency: 'SAR', now: NOW })

describe('parseAmount', () => {
  test('currency word or symbol makes it money', () => {
    expect(parseAmount('lunch 45 SAR')).toMatchObject({ value: 45, currency: 'SAR' })
    expect(parseAmount('$120 hotel')).toMatchObject({ value: 120, currency: 'USD' })
    expect(parseAmount('1,250 riyals rent')).toMatchObject({ value: 1250, currency: 'SAR' })
  })
  test('a spend verb makes a bare number money (default currency)', () => {
    expect(parseAmount('paid 300 for parts', 'SAR')).toMatchObject({ value: 300, currency: 'SAR' })
  })
  test('a bare number with no spend verb / currency is not money', () => {
    expect(parseAmount('call 3 suppliers')).toBeNull()
  })
})

describe('classifyCapture', () => {
  test('expense: amount + item + today', () => {
    const r = c('coffee 18 SAR')
    expect(r.type).toBe('expense')
    expect(r.fields.amount).toBe('18'); expect(r.fields.currency).toBe('SAR')
    expect(r.fields.merchant).toBe('coffee')
    expect(r.fields.date).toBe('2026-01-14')
  })

  test('expense with spend verb and a date', () => {
    const r = c('paid 500 for tyres tomorrow')
    expect(r.type).toBe('expense'); expect(r.fields.amount).toBe('500')
    expect(r.fields.merchant).toMatch(/tyres/); expect(r.fields.date).toBe('2026-01-15')
  })

  test('appointment: keyword + time', () => {
    const r = c('meeting with Sara tomorrow 3pm')
    expect(r.type).toBe('appointment')
    expect(r.fields.date).toBe('2026-01-15'); expect(r.fields.time).toBe('15:00')
    expect(r.fields.title).toMatch(/Sara/)
  })

  test('reminder: explicit "remind" keyword', () => {
    const r = c('remind me to call the plumber at 5pm')
    expect(r.type).toBe('reminder')
    expect(r.fields.text).toBe('call the plumber')
    expect(new Date(r.fields.times[0]).getHours()).toBe(17)
  })

  test('reminder: a bare clock time (no keyword) still becomes a timed reminder', () => {
    const r = c('take medicine 9pm')
    expect(r.type).toBe('reminder')
    expect(new Date(r.fields.times[0]).getHours()).toBe(21)
    expect(r.fields.text).toBe('take medicine')
  })

  test('task: a day but no time → task with a due date', () => {
    const r = c('finish the report friday')
    expect(r.type).toBe('task'); expect(r.fields.dueDate).toBe('2026-01-16')
    expect(r.fields.title).toBe('finish the report')
  })

  test('task: plain to-do with no date', () => {
    const r = c('renew gym membership')
    expect(r.type).toBe('task'); expect(r.fields.dueDate).toBe('')
    expect(r.fields.title).toBe('renew gym membership')
  })

  test('a "today" reminder captured after 9am is scheduled in the future, not the past', () => {
    const r = c('remind me to water the plants today') // NOW is 10:00
    expect(r.type).toBe('reminder')
    expect(new Date(r.fields.times[0]).getTime()).toBeGreaterThan(NOW.getTime())
  })

  test('a spend word without a number is a task, not an expense', () => {
    const r = c('pay the electricity bill')
    expect(r.type).toBe('task')
    expect(r.fields.title).toBe('pay the electricity bill')
  })

  test('currency word after the number is recognised', () => {
    const r = c('hotel 90 dollars')
    expect(r.type).toBe('expense'); expect(r.fields.amount).toBe('90'); expect(r.fields.currency).toBe('USD')
  })

  test('empty input returns null', () => {
    expect(c('   ')).toBeNull()
  })
})
