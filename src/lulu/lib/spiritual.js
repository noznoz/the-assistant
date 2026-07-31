// Salah / spiritual tracking helpers.
import { todayISO } from './format.js'

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export function dayCount(rec) {
  if (!rec || !rec.prayers) return 0
  return PRAYERS.reduce((n, p) => n + (rec.prayers[p] ? 1 : 0), 0)
}
export function dayComplete(rec) { return dayCount(rec) === PRAYERS.length }

// Consecutive complete days ending today (or yesterday if today isn't done yet).
export function prayerStreak(records = []) {
  const byDate = {}
  records.forEach(r => { byDate[r.date] = r })
  let streak = 0
  const start = new Date(todayISO())
  // Allow today to be incomplete without breaking the streak.
  if (!dayComplete(byDate[todayISO()])) start.setDate(start.getDate() - 1)
  for (let i = 0; i < 400; i++) {
    const d = new Date(start.getTime() - i * 86400000).toISOString().slice(0, 10)
    if (dayComplete(byDate[d])) streak++
    else break
  }
  return streak
}

// Prayers completed over the last `days` days (sum across days).
export function weekPrayers(records = [], days = 7) {
  const byDate = {}
  records.forEach(r => { byDate[r.date] = r })
  let total = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(new Date(todayISO()).getTime() - i * 86400000).toISOString().slice(0, 10)
    total += dayCount(byDate[d])
  }
  return total
}
