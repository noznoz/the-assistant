// Offline prayer-time calculation (Umm al-Qura method, used in Saudi Arabia).
// Returns absolute Date objects so display is correct in any timezone; times
// are formatted for the chosen display timezone (default Asia/Riyadh).
// Math adapted from the standard PrayTimes algorithm.

const RIYADH = { lat: 24.7136, lng: 46.6753 }
const DTZ = 'Asia/Riyadh'

// Selectable cities for prayer times. Saudi cities first, then common travel
// destinations. Each carries coordinates and a display timezone.
export const PRAYER_CITIES = [
  { id: 'riyadh', en: 'Riyadh', ar: 'الرياض', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh' },
  { id: 'makkah', en: 'Makkah', ar: 'مكة المكرمة', lat: 21.3891, lng: 39.8579, tz: 'Asia/Riyadh' },
  { id: 'madinah', en: 'Madinah', ar: 'المدينة المنورة', lat: 24.5247, lng: 39.5692, tz: 'Asia/Riyadh' },
  { id: 'jeddah', en: 'Jeddah', ar: 'جدة', lat: 21.4858, lng: 39.1925, tz: 'Asia/Riyadh' },
  { id: 'dammam', en: 'Dammam', ar: 'الدمام', lat: 26.4207, lng: 50.0888, tz: 'Asia/Riyadh' },
  { id: 'khobar', en: 'Al Khobar', ar: 'الخبر', lat: 26.2794, lng: 50.2083, tz: 'Asia/Riyadh' },
  { id: 'taif', en: 'Taif', ar: 'الطائف', lat: 21.2703, lng: 40.4158, tz: 'Asia/Riyadh' },
  { id: 'abha', en: 'Abha', ar: 'أبها', lat: 18.2465, lng: 42.5117, tz: 'Asia/Riyadh' },
  { id: 'tabuk', en: 'Tabuk', ar: 'تبوك', lat: 28.3838, lng: 36.5550, tz: 'Asia/Riyadh' },
  { id: 'buraidah', en: 'Buraidah', ar: 'بريدة', lat: 26.3260, lng: 43.9750, tz: 'Asia/Riyadh' },
  { id: 'hail', en: 'Hail', ar: 'حائل', lat: 27.5114, lng: 41.7208, tz: 'Asia/Riyadh' },
  { id: 'jazan', en: 'Jazan', ar: 'جازان', lat: 16.8892, lng: 42.5511, tz: 'Asia/Riyadh' },
  { id: 'najran', en: 'Najran', ar: 'نجران', lat: 17.4933, lng: 44.1277, tz: 'Asia/Riyadh' },
  { id: 'yanbu', en: 'Yanbu', ar: 'ينبع', lat: 24.0895, lng: 38.0637, tz: 'Asia/Riyadh' },
  { id: 'neom', en: 'NEOM', ar: 'نيوم', lat: 27.9760, lng: 35.2330, tz: 'Asia/Riyadh' },
  { id: 'dubai', en: 'Dubai', ar: 'دبي', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  { id: 'abudhabi', en: 'Abu Dhabi', ar: 'أبوظبي', lat: 24.4539, lng: 54.3773, tz: 'Asia/Dubai' },
  { id: 'doha', en: 'Doha', ar: 'الدوحة', lat: 25.2854, lng: 51.5310, tz: 'Asia/Qatar' },
  { id: 'kuwait', en: 'Kuwait City', ar: 'الكويت', lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait' },
  { id: 'manama', en: 'Manama', ar: 'المنامة', lat: 26.2285, lng: 50.5860, tz: 'Asia/Bahrain' },
  { id: 'muscat', en: 'Muscat', ar: 'مسقط', lat: 23.5880, lng: 58.3829, tz: 'Asia/Muscat' },
  { id: 'cairo', en: 'Cairo', ar: 'القاهرة', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo' },
  { id: 'amman', en: 'Amman', ar: 'عمّان', lat: 31.9539, lng: 35.9106, tz: 'Asia/Amman' },
  { id: 'istanbul', en: 'Istanbul', ar: 'إسطنبول', lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  { id: 'london', en: 'London', ar: 'لندن', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { id: 'paris', en: 'Paris', ar: 'باريس', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
]

export function findCity(id) {
  return PRAYER_CITIES.find(c => c.id === id) || PRAYER_CITIES[0]
}
export const cityName = (city, lang = 'en') => city ? (lang === 'ar' ? city.ar : city.en) : ''
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

// Compact Hijri (day + abbreviated month) for the Today calendar tile.
export function hijriShort(date = new Date(), lang = 'en') {
  try {
    const loc = (lang === 'ar' ? 'ar-SA' : 'en-US') + '-u-ca-islamic-umalqura'
    return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(date)
  } catch { return '' }
}
