import { describe, expect, test } from 'vitest'
import { briefSummary } from './dayBrief.js'

const NOW = new Date(2026, 0, 14, 12, 0, 0, 0)
const day = (o) => new Date(2026, 0, 14 + o).toISOString().slice(0, 10)
const s = (d) => briefSummary({ ...d, now: NOW })

describe('briefSummary', () => {
  test('summarises due/overdue tasks, next appointment and reminders', () => {
    const out = s({
      tasks: [
        { status: 'todo', dueDate: day(0) },
        { status: 'todo', dueDate: day(0) },
        { status: 'todo', dueDate: day(-3) },
        { status: 'completed', dueDate: day(0) }, // ignored
      ],
      appointments: [{ title: 'Dentist', date: day(0), time: '10:00' }, { title: 'Bank', date: day(0), time: '14:00' }],
      reminders: [{ text: 'Pay rent', remindAt: new Date(2026, 0, 14, 9, 0).toISOString() }],
    })
    expect(out).toBe('2 due today · 1 overdue · 10:00 Dentist +1 · 1 reminder')
  })

  test('a clear day says so', () => {
    expect(s({ tasks: [{ status: 'todo', dueDate: day(5) }] })).toBe('Your day is clear.')
  })

  test('done reminders and future reminders are excluded', () => {
    const out = s({ reminders: [
      { text: 'a', remindAt: new Date(2026, 0, 14, 8, 0).toISOString() },
      { text: 'b', remindAt: new Date(2026, 0, 14, 8, 0).toISOString(), done: true },
      { text: 'c', remindAt: day(3) + 'T09:00:00' },
    ] })
    expect(out).toBe('1 reminder')
  })
})
