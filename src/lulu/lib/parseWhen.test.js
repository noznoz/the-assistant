import { describe, expect, test } from 'vitest'
import { parseWhen } from './parseWhen.js'

// Fixed "now": Wed 2026-01-14 10:00 local.
const NOW = new Date(2026, 0, 14, 10, 0, 0, 0)
const p = (s) => parseWhen(s, NOW)
const at = (s) => { const r = p(s); return r.at ? new Date(r.at) : null }

describe('parseWhen', () => {
  test('tomorrow + pm time, strips the phrase', () => {
    const r = p('call workshop tomorrow 5pm')
    const d = new Date(r.at)
    expect(d.getFullYear()).toBe(2026); expect(d.getMonth()).toBe(0); expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(17); expect(d.getMinutes()).toBe(0)
    expect(r.text).toBe('call workshop')
  })

  test('"at 17:30" 24h time today', () => {
    const d = at('submit report at 17:30')
    expect(d.getDate()).toBe(14); expect(d.getHours()).toBe(17); expect(d.getMinutes()).toBe(30)
    expect(p('submit report at 17:30').text).toBe('submit report')
  })

  test('bare past time rolls to tomorrow', () => {
    const d = at('pay bill 8am') // 8am already passed at 10:00
    expect(d.getDate()).toBe(15); expect(d.getHours()).toBe(8)
  })

  test('month-day date defaults to 9:00', () => {
    const d = at('renew iqama Dec 3')
    expect(d.getMonth()).toBe(11); expect(d.getDate()).toBe(3); expect(d.getHours()).toBe(9)
    expect(p('renew iqama Dec 3').text).toBe('renew iqama')
  })

  test('a month-day already passed jumps to next year', () => {
    const d = at('taxes Jan 2')
    expect(d.getFullYear()).toBe(2027); expect(d.getMonth()).toBe(0); expect(d.getDate()).toBe(2)
  })

  test('"in 2 hours" is relative to now', () => {
    const d = at('coffee in 2 hours')
    expect(d.getHours()).toBe(12); expect(d.getDate()).toBe(14)
    expect(p('coffee in 2 hours').text).toBe('coffee')
  })

  test('weekday picks the next occurrence', () => {
    const d = at('gym on friday') // Wed 14th → Fri 16th
    expect(d.getDate()).toBe(16); expect(d.getHours()).toBe(9)
  })

  test('tonight → 8pm today', () => {
    const d = at('dinner tonight')
    expect(d.getDate()).toBe(14); expect(d.getHours()).toBe(20)
  })

  test('no date returns null and leaves text untouched', () => {
    const r = p('buy milk')
    expect(r.at).toBeNull(); expect(r.text).toBe('buy milk')
  })

  test('strips "remind me to" filler', () => {
    expect(p('remind me to call mom tomorrow').text).toBe('call mom')
  })
})
