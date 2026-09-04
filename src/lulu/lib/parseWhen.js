// Lightweight natural-language date/time parser for quick reminder entry.
// parseWhen("call workshop tomorrow 5pm") → { at: <ISO>, text: "call workshop" }
// English, best-effort: returns { at: null, text } when it finds no time, so it
// never guesses wildly. Handles: today/tonight/tomorrow/next week, weekdays
// (optionally "next"), "in N hours/mins/days/weeks", clock times (5pm, 5:30pm,
// at 17:00, noon, midnight, morning/afternoon/evening), and month-day dates
// (Dec 3 / 3 Dec / December 3).

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Remove the first (case-insensitive) occurrence of `frag` from `text`, tidying
// up the leftover spaces/punctuation.
function removeOnce(text, frag) {
  if (!frag) return text
  const i = text.toLowerCase().indexOf(frag.toLowerCase())
  if (i < 0) return text
  return (text.slice(0, i) + text.slice(i + frag.length))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
}

// Strip common leftover filler once the date phrase is removed.
function tidy(text) {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/^(remind me to|remind me|reminder to|to)\s+/i, '')
    .replace(/\s+(at|on|by|this|next)\s*$/i, '')
    .replace(/^\s*[-–,]\s*/, '')
    .trim()
}

export function parseWhen(input, now = new Date()) {
  const raw = input || ''
  if (!raw.trim()) return { at: null, text: raw }
  const lower = raw.toLowerCase()
  let text = raw
  const drop = (frag) => { text = removeOnce(text, frag) }

  let day = null            // Date at local midnight for the target day
  let hasDay = false
  let hour = 9, min = 0     // default 9:00 when a day is given without a time
  let hasTime = false

  // ---- Relative "in N hours/minutes/days/weeks" (may fully define the moment) ----
  const inM = lower.match(/\bin\s+(a|an|\d+)\s+(hours?|mins?|minutes?|days?|weeks?)\b/)
  if (inM) {
    const n = (inM[1] === 'a' || inM[1] === 'an') ? 1 : parseInt(inM[1], 10)
    const u = inM[2]
    const d = new Date(now)
    if (/hour/.test(u)) d.setHours(d.getHours() + n)
    else if (/min/.test(u)) d.setMinutes(d.getMinutes() + n)
    else if (/day/.test(u)) d.setDate(d.getDate() + n)
    else if (/week/.test(u)) d.setDate(d.getDate() + 7 * n)
    drop(inM[0])
    if (/hour|min/.test(u)) return { at: d.toISOString(), text: tidy(text), hasTime: true } // time is inherent
    day = new Date(d); day.setHours(0, 0, 0, 0); hasDay = true
  }

  // ---- Clock time ----
  const ampm = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  const at24 = lower.match(/\bat\s+(\d{1,2}):(\d{2})\b/)
  if (ampm) {
    hour = parseInt(ampm[1], 10) % 12
    if (ampm[3] === 'pm') hour += 12
    min = ampm[2] ? parseInt(ampm[2], 10) : 0
    hasTime = true; drop(ampm[0])
  } else if (at24) {
    hour = parseInt(at24[1], 10); min = parseInt(at24[2], 10); hasTime = true; drop(at24[0])
  } else if (/\bnoon\b/.test(lower)) { hour = 12; min = 0; hasTime = true; drop('noon') }
  else if (/\bmidnight\b/.test(lower)) { hour = 0; min = 0; hasTime = true; drop('midnight') }
  else if (/\btonight\b/.test(lower)) { hour = 20; min = 0; hasTime = true; if (!hasDay) { day = new Date(now); day.setHours(0, 0, 0, 0); hasDay = true } drop('tonight') }
  else if (/\bmorning\b/.test(lower)) { hour = 9; min = 0; hasTime = true; drop('morning') }
  else if (/\bafternoon\b/.test(lower)) { hour = 15; min = 0; hasTime = true; drop('afternoon') }
  else if (/\bevening\b/.test(lower)) { hour = 19; min = 0; hasTime = true; drop('evening') }

  // ---- Day words / weekday / explicit date (skip if "in N days" already set it) ----
  if (!hasDay) {
    if (/\btoday\b/.test(lower)) { day = new Date(now); hasDay = true; drop('today') }
    else if (/\btomorrow\b/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + 1); day = d; hasDay = true; drop('tomorrow') }
    else if (/\bnext week\b/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + 7); day = d; hasDay = true; drop('next week') }
    else {
      const wd = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
      if (wd) {
        const target = WEEKDAYS.indexOf(wd[2])
        const d = new Date(now)
        let diff = (target - d.getDay() + 7) % 7
        if (diff === 0) diff = 7 // always the next occurrence
        d.setDate(d.getDate() + diff)
        day = d; hasDay = true; drop(wd[0])
      } else {
        const md = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/)
        const dm = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/)
        let mon = null, dd = null, frag = null
        if (md) { mon = MONTHS.indexOf(md[1]); dd = parseInt(md[2], 10); frag = md[0] }
        else if (dm) { mon = MONTHS.indexOf(dm[2]); dd = parseInt(dm[1], 10); frag = dm[0] }
        if (mon != null && mon >= 0 && dd >= 1 && dd <= 31) {
          const d = new Date(now.getFullYear(), mon, dd)
          const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          if (d < todayMid) d.setFullYear(d.getFullYear() + 1) // a date already past → next year
          day = d; hasDay = true; drop(frag)
        }
      }
    }
  }

  if (!hasDay && !hasTime) return { at: null, text: raw, hasTime: false }

  const at = hasDay ? new Date(day) : new Date(now)
  at.setHours(hasTime ? hour : (hasDay ? 9 : now.getHours()), hasTime ? min : (hasDay ? 0 : now.getMinutes()), 0, 0)
  // A bare time with no day that's already passed today → assume tomorrow.
  if (!hasDay && hasTime && at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1)

  return { at: at.toISOString(), text: tidy(text), hasTime }
}
