import { describe, expect, test } from 'vitest'
import { dueReminders, splitReminders } from './reminders.js'

const iso = (ms) => new Date(ms).toISOString()

describe('reminders logic', () => {
  test('dueReminders returns only past, un-notified, not-done', () => {
    const now = Date.now()
    const items = [
      { id: '1', text: 'past', remindAt: iso(now - 1000) },
      { id: '2', text: 'future', remindAt: iso(now + 100000) },
      { id: '3', text: 'past-notified', remindAt: iso(now - 1000), notified: true },
      { id: '4', text: 'past-done', remindAt: iso(now - 1000), done: true },
    ]
    expect(dueReminders(items).map(r => r.id)).toEqual(['1'])
    expect(dueReminders([])).toEqual([])
  })

  test('splitReminders separates upcoming (asc) from past (desc)', () => {
    const now = Date.now()
    const items = [
      { id: 'a', remindAt: iso(now + 2000) },
      { id: 'b', remindAt: iso(now + 1000) },
      { id: 'c', remindAt: iso(now - 1000) },
      { id: 'd', remindAt: iso(now - 5000), done: true },
      { id: 'skip' }, // no remindAt → ignored
    ]
    const { upcoming, past } = splitReminders(items)
    expect(upcoming.map(r => r.id)).toEqual(['b', 'a'])
    expect(past.map(r => r.id)).toEqual(['c', 'd'])
  })

  test('a done future reminder is treated as past', () => {
    const now = Date.now()
    const { upcoming, past } = splitReminders([{ id: 'x', remindAt: iso(now + 9999), done: true }])
    expect(upcoming).toHaveLength(0)
    expect(past.map(r => r.id)).toEqual(['x'])
  })
})
