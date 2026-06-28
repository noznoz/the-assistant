import { useState, useRef, useEffect } from 'react'

// Location search using OpenStreetMap Nominatim — free, no API key needed.
export default function PlaceInput({ value, onChange, placeholder, style }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const debounce = useRef(null)
  const container = useRef(null)

  // Keep internal query in sync if parent resets value
  useEffect(() => { setQuery(value || '') }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e) { if (container.current && !container.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q)
    clearTimeout(debounce.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch { setSuggestions([]); setOpen(false) }
    }, 400)
  }

  function pick(place) {
    const text = place.display_name
    setQuery(text)
    onChange(text)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={container} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        style={style}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, marginTop: 2, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => pick(s)}
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
