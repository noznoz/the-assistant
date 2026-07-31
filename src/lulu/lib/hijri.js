// Hijri (Umm al-Qura) helpers via Intl — fully offline. Finds the next Gregorian
// date for each Islamic occasion by walking forward day-by-day and matching the
// Hijri month/day (the reliable way without a conversion table).

export function hijriParts(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn',
      { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date)
    const g = (type) => parseInt((parts.find(p => p.type === type) || {}).value, 10)
    const y = g('year'), m = g('month'), d = g('day')
    if (!y || !m || !d) return null
    return { year: y, month: m, day: d }
  } catch { return null }
}

export const ISLAMIC_OCCASIONS = [
  { key: 'ramadan', en: 'Ramadan begins', ar: 'بداية رمضان', month: 9, day: 1, icon: 'sparkle' },
  { key: 'eidFitr', en: 'Eid al-Fitr', ar: 'عيد الفطر', month: 10, day: 1, icon: 'gift' },
  { key: 'hajj', en: 'Hajj begins', ar: 'بداية الحج', month: 12, day: 8, icon: 'trip' },
  { key: 'arafah', en: 'Day of Arafah', ar: 'يوم عرفة', month: 12, day: 9, icon: 'sparkle' },
  { key: 'eidAdha', en: 'Eid al-Adha', ar: 'عيد الأضحى', month: 12, day: 10, icon: 'gift' },
  { key: 'newYear', en: 'Islamic New Year', ar: 'رأس السنة الهجرية', month: 1, day: 1, icon: 'calendar' },
  { key: 'ashura', en: 'Ashura', ar: 'عاشوراء', month: 1, day: 10, icon: 'sparkle' },
  { key: 'mawlid', en: 'Mawlid al-Nabi', ar: 'المولد النبوي', month: 3, day: 12, icon: 'sparkle' },
]

// The next occurrence of each occasion within the horizon, soonest first.
export function upcomingOccasions(from = new Date(), horizonDays = 800) {
  const out = []
  const seen = new Set()
  const base = new Date(from.toISOString().slice(0, 10))
  for (let i = 0; i <= horizonDays; i++) {
    const dt = new Date(base.getTime() + i * 86400000)
    const h = hijriParts(dt)
    if (!h) break
    ISLAMIC_OCCASIONS.forEach(o => {
      if (!seen.has(o.key) && h.month === o.month && h.day === o.day) {
        seen.add(o.key)
        out.push({ ...o, date: dt, days: i, hyear: h.year })
      }
    })
    if (seen.size === ISLAMIC_OCCASIONS.length) break
  }
  return out.sort((a, b) => a.days - b.days)
}
