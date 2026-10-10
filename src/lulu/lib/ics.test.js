import { describe, expect, test } from 'vitest'
import { buildICS } from './ics.js'

describe('buildICS', () => {
  test('wraps events in a valid VCALENDAR with a timed event + alarm', () => {
    const out = buildICS([
      { start: new Date(2026, 0, 14, 10, 30), durationMin: 60, summary: 'Dentist', location: 'Clinic', alarmMin: 30 },
    ], { name: 'The Assistant' })
    expect(out).toContain('BEGIN:VCALENDAR')
    expect(out).toContain('END:VCALENDAR')
    expect(out).toContain('SUMMARY:Dentist')
    expect(out).toContain('DTSTART:20260114T103000')
    expect(out).toContain('DTEND:20260114T113000')
    expect(out).toContain('TRIGGER:-PT30M')
    expect(out).toContain('LOCATION:Clinic')
  })

  test('all-day event uses VALUE=DATE and spans to the next day', () => {
    const out = buildICS([{ allDay: true, date: '2026-03-01', summary: 'Istimara expires' }])
    expect(out).toContain('DTSTART;VALUE=DATE:20260301')
    expect(out).toContain('DTEND;VALUE=DATE:20260302')
    expect(out).toContain('SUMMARY:Istimara expires')
  })

  test('escapes commas/semicolons and skips invalid events', () => {
    const out = buildICS([
      { summary: '' },                                   // skipped (no summary)
      { start: new Date('nope'), summary: 'bad' },       // skipped (bad date)
      { allDay: true, date: '2026-05-05', summary: 'Pay fees, on time; please' },
    ])
    expect(out).toContain('SUMMARY:Pay fees\\, on time\\; please')
    expect((out.match(/BEGIN:VEVENT/g) || []).length).toBe(1)
  })
})
