import { describe, expect, test } from 'vitest'
import { dueReminders, splitReminders, buildReminderFields, reminderTimes, firedCountOf, pendingCount } from './reminders.js'

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

describe('multi-time reminders', () => {
  test('buildReminderFields sorts, dedupes, and counts past times as fired', () => {
    const now = Date.now()
    const f = buildReminderFields('take pill', [iso(now + 2000), iso(now - 1000), iso(now + 1000), iso(now + 2000)])
    expect(f.times).toEqual([iso(now - 1000), iso(now + 1000), iso(now + 2000)])
    expect(f.firedCount).toBe(1)                 // the one past time is pre-fired
    expect(f.remindAt).toBe(iso(now + 1000))     // mirror points at next pending
    expect(f.notified).toBe(false)
  })

  test('a reminder with a due un-fired time is due; fully-fired is not', () => {
    const now = Date.now()
    const partial = { id: 'p', times: [iso(now - 1000), iso(now + 5000)], firedCount: 0 }
    const allFired = { id: 'a', times: [iso(now - 2000), iso(now - 1000)], firedCount: 2 }
    expect(dueReminders([partial, allFired]).map(r => r.id)).toEqual(['p'])
  })

  test('pendingCount and firedCountOf reflect remaining alerts', () => {
    const now = Date.now()
    const r = { times: [iso(now - 1000), iso(now + 1000), iso(now + 2000)], firedCount: 1 }
    expect(reminderTimes(r)).toHaveLength(3)
    expect(firedCountOf(r)).toBe(1)
    expect(pendingCount(r)).toBe(2)
  })

  test('legacy single-time record still normalizes', () => {
    const now = Date.now()
    const legacy = { remindAt: iso(now + 1000), notified: false }
    expect(reminderTimes(legacy)).toEqual([iso(now + 1000)])
    expect(firedCountOf(legacy)).toBe(0)
    const fired = { remindAt: iso(now - 1000), notified: true }
    expect(firedCountOf(fired)).toBe(1)
  })
})
