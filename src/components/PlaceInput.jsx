import { useState, useRef, useEffect } from 'react'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

// Load the Google Maps JS + Places library once, shared across all instances.
let mapsReady = null
function ensureGoogleMaps() {
  if (!GOOGLE_KEY || GOOGLE_KEY === 'YOUR_API_KEY_HERE') return Promise.reject('no key')
  if (window.google?.maps?.places) return Promise.resolve()
  if (!mapsReady) {
    mapsReady = new Promise((resolve, reject) => {
      const cb = '_gmCb'
      window[cb] = resolve
      const s = document.createElement('script')
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&callback=${cb}`
      s.async = true
      s.onerror = () => { mapsReady = null; reject() }
      document.head.appendChild(s)
    })
  }
  return mapsReady
}

// PlaceInput — location search with autocomplete.
// Props:
//   value        string   controlled text value
//   onChange     fn(text) called whenever text changes
//   onCoords     fn({ name, lat, lng, mapsUrl }) | fn(null)  called when a place is selected/cleared
//   placeholder  string
//   style        object
export default function PlaceInput({ value, onChange, onCoords, placeholder, style }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const inputRef = useRef(null)
  const debounce = useRef(null)
  const container = useRef(null)
  const acRef = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  // Try to load Google Places Autocomplete
  useEffect(() => {
    ensureGoogleMaps()
      .then(() => {
        setGoogleReady(true)
        if (inputRef.current && !acRef.current) {
          acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
            fields: ['name', 'formatted_address', 'geometry', 'url'],
          })
          acRef.current.addListener('place_changed', () => {
            const place = acRef.current.getPlace()
            if (!place?.geometry) return
            const name = place.formatted_address || place.name || ''
            const lat = place.geometry.location.lat()
            const lng = place.geometry.location.lng()
            const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
            setQuery(name)
            onChange(name)
            onCoords?.({ name, lat, lng, mapsUrl })
          })
        }
      })
      .catch(() => setGoogleReady(false))
  }, [])

  // Close Nominatim dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (container.current && !container.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q)
    onCoords?.(null)

    if (googleReady) return // Google Autocomplete handles its own UI

    // Fallback: Nominatim search
    clearTimeout(debounce.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch { setSuggestions([]); setOpen(false) }
    }, 400)
  }

  function pickNominatim(place) {
    const text = place.display_name
    const lat = parseFloat(place.lat)
    const lng = parseFloat(place.lon)
    setQuery(text)
    onChange(text)
    onCoords?.({ name: text, lat, lng, mapsUrl: `https://www.google.com/maps?q=${lat},${lng}` })
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={container} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onFocus={() => !googleReady && suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        style={style}
        autoComplete="off"
      />
      {open && !googleReady && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, marginTop: 2, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => pickNominatim(s)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 12, color: 'var(--text)', lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--orange)', fontWeight: 600 }}>📍 </span>
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
