import { describe, expect, test } from 'vitest'
import { buildNotificationFeed } from './notifications.js'

const t = (k) => k
const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
const find = (feed, id) => feed.find(x => x.id === id)

describe('notification feed "soon" (due today / overdue) flags', () => {
  test('overdue and today tasks are soon; a far-out doc is not', () => {
    const feed = buildNotificationFeed({
      tasks: [
        { id: 'o', title: 'overdue', status: 'todo', dueDate: iso(-2) },
        { id: 'n', title: 'today', status: 'todo', dueDate: iso(0) },
      ],
      docs: [{ id: 'd1', title: 'passport', expiry: iso(20) }],
      t,
    })
    expect(find(feed, 'to').soon).toBe(true)
    expect(find(feed, 'dn').soon).toBe(true)
    expect(find(feed, 'docd1').soon).toBe(false) // 20 days out — shown but no alert
  })

  test('an appointment and subscription due today are soon', () => {
    const feed = buildNotificationFeed({
      appointments: [{ id: 'a1', title: 'dentist', date: iso(0) }],
      subs: [{ id: 's1', name: 'Netflix', nextDue: iso(0) }],
      t,
    })
    expect(find(feed, 'appta1').soon).toBe(true)
    expect(find(feed, 'subs1').soon).toBe(true)
  })

  test('reminders never carry a soon flag (they fire via their own path)', () => {
    const feed = buildNotificationFeed({
      reminders: [{ id: 'r1', text: 'due reminder', remindAt: new Date(Date.now() - 1000).toISOString() }],
      t,
    })
    expect(find(feed, 'remr1').soon).toBeUndefined()
  })
})
