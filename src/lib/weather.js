import { parseTripDate } from './calendar.js'

// WMO weather code → emoji + label (Open-Meteo daily weathercode)
const WMO = {
  0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'],
  61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨️', 'Snow grains'],
  80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Violent showers'],
  85: ['🌨️', 'Snow showers'], 86: ['❄️', 'Snow showers'],
  95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Storm w/ hail'], 99: ['⛈️', 'Storm w/ hail'],
}

export function describeWeatherCode(code) {
  return WMO[code] || ['🌡️', 'Forecast']
}

// Fetch the daily forecast for a place name on the trip's date.
// Returns null if the place can't be geocoded or the date is outside the
// ~16-day forecast window (Open-Meteo only forecasts the near future).
export async function fetchTripWeather(place, dateStr) {
  const date = parseTripDate(dateStr)
  if (!place || !date) return null

  const daysOut = Math.floor((date - new Date()) / 86400000)
  if (daysOut < 0) return { unavailable: 'past' }
  if (daysOut > 15) return { unavailable: 'far' }

  try {
    // The geocoder doesn't accept "City, ST" — try the raw string, then fall
    // back to just the part before the first comma (the city name).
    const candidates = [place]
    if (place.includes(',')) candidates.push(place.split(',')[0].trim())
    let loc = null
    for (const q of candidates) {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`
      ).then(r => r.json())
      if (geo?.results?.[0]) { loc = geo.results[0]; break }
    }
    if (!loc) return { unavailable: 'nodata' }

    const iso = date.toISOString().slice(0, 10)
    const f = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=celsius&timezone=auto&start_date=${iso}&end_date=${iso}`
    ).then(r => r.json())

    const d = f?.daily
    if (!d || !d.time?.length) return { unavailable: 'nodata' }
    const [emoji, label] = describeWeatherCode(d.weathercode[0])
    return {
      place: loc.name,
      emoji, label,
      hi: Math.round(d.temperature_2m_max[0]),
      lo: Math.round(d.temperature_2m_min[0]),
      rain: d.precipitation_probability_max?.[0] ?? null,
    }
  } catch {
    return { unavailable: 'nodata' }
  }
}
