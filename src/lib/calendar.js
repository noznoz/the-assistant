// Parse the app's trip date strings into a JS Date (start of the trip).
// Handles "Jul 12, 2025" and ranges like "Aug 4–10, 2025" / "Aug 4-10, 2025".
export function parseTripDate(dateStr) {
  if (!dateStr) return null
  // Normalise an en-dash range "Aug 4–10, 2025" → "Aug 4, 2025"
  const m = dateStr.match(/^([A-Za-z]+)\s+(\d+)\s*[–-]\s*\d+,\s*(\d{4})$/)
  const normalized = m ? `${m[1]} ${m[2]}, ${m[3]}` : dateStr
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? null : d
}

function fmtICSDate(d) {
  // All-day style: YYYYMMDD
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

// Build and download an .ics calendar event for a trip.
export function downloadTripICS(trip) {
  const start = parseTripDate(trip.date)
  if (!start) { alert('Could not read this ride\'s date.'); return }
  const end = new Date(start); end.setDate(end.getDate() + 1)

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Road Heaven//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:trip-${trip.id}@riding-crew`,
    `DTSTAMP:${fmtICSDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${fmtICSDate(start)}`,
    `DTEND;VALUE=DATE:${fmtICSDate(end)}`,
    `SUMMARY:🏍️ ${escapeICS(trip.name)}`,
    `LOCATION:${escapeICS(trip.meeting || trip.from || '')}`,
    `DESCRIPTION:${escapeICS(
      [trip.classification && `Type: ${trip.classification}`,
       trip.from && trip.to && `Route: ${trip.from} → ${trip.to}`,
       trip.distance && `Distance: ${trip.distance}`,
       trip.meeting && `Meet: ${trip.meeting}`,
       trip.notes].filter(Boolean).join('\\n'))}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
    `DESCRIPTION:Ride tomorrow — ${escapeICS(trip.name)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeICS(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}
