// Build an iCalendar (.ics) file the phone's Calendar app can import — so
// appointments, due tasks, reminders, renewals and prayer times show up there
// with NATIVE alerts that fire even when this app is fully closed (the one
// thing a PWA can't do on iOS by itself).
//
// Times are emitted as "floating" local wall-clock (no timezone/Z), so the
// Calendar app shows them in the device's own timezone — correct for a user on
// their home device. DTSTAMP is the only UTC value (spec requirement).

const PAD = (n) => String(n).padStart(2, '0')
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const localFloat = (d) => `${d.getFullYear()}${PAD(d.getMonth() + 1)}${PAD(d.getDate())}T${PAD(d.getHours())}${PAD(d.getMinutes())}00`
const dateBasic = (s) => String(s).replace(/-/g, '')
const utcStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// RFC 5545 line folding at 73 octets (keep lines short; CRLF + leading space).
function fold(line) {
  if (line.length <= 73) return line
  let out = line.slice(0, 73); let rest = line.slice(73)
  while (rest.length > 72) { out += '\r\n ' + rest.slice(0, 72); rest = rest.slice(72) }
  return out + '\r\n ' + rest
}

const nextDay = (dateStr) => { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${PAD(d.getMonth() + 1)}${PAD(d.getDate())}` }

// events: array of
//   { start: Date, durationMin?, summary, desc?, location?, alarmMin? }   (timed)
//   { allDay: true, date: 'YYYY-MM-DD', summary, desc?, alarmMin? }        (all-day)
export function buildICS(events = [], { name = 'The Assistant' } = {}) {
  const stamp = utcStamp()
  let seq = 0
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Assistant//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name)]
  for (const e of events) {
    if (!e || !e.summary) continue
    L.push('BEGIN:VEVENT', `UID:lulu-${stamp}-${seq++}@the-assistant`, 'DTSTAMP:' + stamp)
    if (e.allDay) {
      if (!e.date) { L.pop(); L.pop(); L.pop(); continue }
      L.push('DTSTART;VALUE=DATE:' + dateBasic(e.date), 'DTEND;VALUE=DATE:' + nextDay(e.date))
    } else {
      if (!(e.start instanceof Date) || isNaN(e.start)) { L.pop(); L.pop(); L.pop(); continue }
      const end = e.end instanceof Date ? e.end : new Date(e.start.getTime() + (e.durationMin || 60) * 60000)
      L.push('DTSTART:' + localFloat(e.start), 'DTEND:' + localFloat(end))
    }
    L.push('SUMMARY:' + esc(e.summary))
    if (e.desc) L.push('DESCRIPTION:' + esc(e.desc))
    if (e.location) L.push('LOCATION:' + esc(e.location))
    if (e.alarmMin != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${Math.max(0, e.alarmMin)}M`, 'DESCRIPTION:' + esc(e.summary), 'END:VALARM')
    L.push('END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(fold).join('\r\n')
}
