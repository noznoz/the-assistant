import { describe, expect, test } from 'vitest'
import { buildAssistantContext } from './assistantContext.js'

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

describe('buildAssistantContext', () => {
  test('summarizes open/overdue tasks, this-month spend and expiring docs', () => {
    const now = Date.now()
    const data = {
      tasks: [
        { id: '1', title: 'Pay rent', status: 'new', dueDate: iso(now - 86400000), priority: 'high' },
        { id: '2', title: 'Done thing', status: 'completed' },
      ],
      expenses: [{ id: 'e1', amount: 250, currency: 'SAR', date: iso(now) }],
      documents: [{ id: 'd1', title: 'Passport', category: 'id', expiry: iso(now + 20 * 86400000) }],
    }
    const ctx = buildAssistantContext(data, { currency: 'SAR', name: 'Nizar' })

    expect(ctx).toMatch(/OPEN TASKS: 1 total, 1 overdue/)
    expect(ctx).toMatch(/Pay rent/)
    expect(ctx).toMatch(/OVERDUE/)
    expect(ctx).not.toMatch(/Done thing/)     // completed tasks are excluded
    expect(ctx).toMatch(/250/)                 // month spend surfaced
    expect(ctx).toMatch(/Passport/)            // expiring document surfaced
  })

  test('is safe on empty data', () => {
    const ctx = buildAssistantContext({}, { currency: 'SAR' })
    expect(typeof ctx).toBe('string')
    expect(ctx).toMatch(/Today:/)
  })
})
