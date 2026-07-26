// Offline prayer-time calculation (Umm al-Qura method, used in Saudi Arabia).
// Returns absolute Date objects so display is correct in any timezone; times
// are formatted for the chosen display timezone (default Asia/Riyadh).
// Math adapted from the standard PrayTimes algorithm.

const RIYADH = { lat: 24.7136, lng: 46.6753 }
const DTZ = 'Asia/Riyadh'
const FAJR_ANGLE = 18.5
const ISHA_INTERVAL = 90       // minutes after Maghrib (Umm al-Qura)

const dtr = (d) => (d * Math.PI) / 180
const rtd = (r) => (r * 180) / Math.PI
const dsin = (d) => Math.sin(dtr(d))
const dcos = (d) => Math.cos(dtr(d))
const dtan = (d) => Math.tan(dtr(d))
const darcsin = (x) => rtd(Math.asin(x))
const darccos = (x) => rtd(Math.acos(x))
const darctan2 = (y, x) => rtd(Math.atan2(y, x))
const darccot = (x) => rtd(Math.atan(1 / x))
const fixAngle = (a) => { a = a % 360; return a < 0 ? a + 360 : a }
const fixHour = (h) => { h = h % 24; return h < 0 ? h + 24 : h }

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

function sunPosition(jd) {
  const D = jd - 2451545.0
  const g = fixAngle(357.529 + 0.98560028 * D)
  const q = fixAngle(280.459 + 0.98564736 * D)
  const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g))
  const e = 23.439 - 0.00000036 * D
  const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15
  const decl = darcsin(dsin(e) * dsin(L))
  const eqt = q / 15 - fixHour(RA)
  return { declination: decl, equation: eqt }
}

// Compute the raw prayer hours (UTC clock hours) for a date at given coords.
function computeHours(date, lat, lng) {
  const jdBase = julian(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) - lng / (15 * 24)
  const midDay = (t) => fixHour(12 - sunPosition(jdBase + t).equation)
  const sunAngle = (angle, t, ccw) => {
    const decl = sunPosition(jdBase + t).declination
    const noon = midDay(t)
    const term = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))
    const a = (1 / 15) * darccos(Math.max(-1, Math.min(1, term)))
    return noon + (ccw ? -a : a)
  }
  const asrTime = (t) => {
    const decl = sunPosition(jdBase + t).declination
    const angle = -darccot(1 + dtan(Math.abs(lat - decl)))
    return sunAngle(angle, t, false)
  }
  // one refinement pass from sensible initial guesses (hours/24)
  let fajr = sunAngle(FAJR_ANGLE, 5 / 24, true)
  let dhuhr = midDay(12 / 24)
  let asr = asrTime(13 / 24)
  let maghrib = sunAngle(0.833, 18 / 24, false)
  fajr = sunAngle(FAJR_ANGLE, fajr / 24, true)
  dhuhr = midDay(dhuhr / 24)
  asr = asrTime(asr / 24)
  maghrib = sunAngle(0.833, maghrib / 24, false)
  // convert local-mean to UTC clock hours
  const adj = -lng / 15
  return {
    fajr: fixHour(fajr + adj),
    dhuhr: fixHour(dhuhr + adj),
    asr: fixHour(asr + adj),
    maghrib: fixHour(maghrib + adj),
    isha: fixHour(maghrib + adj + ISHA_INTERVAL / 60),
  }
}

function toDate(baseUTC, hours) {
  const d = new Date(baseUTC)
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() + hours * 3600 * 1000)
}

export function prayerTimes(date = new Date(), coords = RIYADH) {
  const h = computeHours(date, coords.lat, coords.lng)
  const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
  return order.map((name) => ({ name, date: toDate(date, h[name]) }))
}

export function fmtPrayer(d, lang = 'en', tz = DTZ) {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
    }).format(d)
  } catch { return '' }
}

// The next upcoming prayer (rolls to tomorrow's Fajr after Isha).
export function nextPrayer(now = new Date(), coords = RIYADH) {
  const today = prayerTimes(now, coords)
  const up = today.find((p) => p.date.getTime() > now.getTime())
  if (up) return up
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000)
  return prayerTimes(tomorrow, coords)[0]
}

export function countdown(target, now = new Date(), lang = 'en') {
  let mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000))
  const h = Math.floor(mins / 60); mins = mins % 60
  if (lang === 'ar') return h ? `${h} س ${mins} د` : `${mins} د`
  return h ? `${h}h ${mins}m` : `${mins}m`
}

// Hijri (Umm al-Qura) date string, offline via Intl.
export function hijriDate(date = new Date(), lang = 'en') {
  try {
    const loc = (lang === 'ar' ? 'ar-SA' : 'en-US') + '-u-ca-islamic-umalqura'
    return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  } catch { return '' }
}
