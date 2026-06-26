const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

function hasKey() {
  return API_KEY && API_KEY !== 'YOUR_API_KEY_HERE'
}

function Placeholder({ height, label }) {
  return (
    <div style={{
      height,
      background: '#111',
      border: '1px solid var(--border)',
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: 'var(--text-muted)',
      fontSize: 13,
      textAlign: 'center',
      padding: 12,
    }}>
      <span style={{ fontSize: 28 }}>🗺️</span>
      {label ? (
        <span style={{ color: 'var(--text)' }}>{label}</span>
      ) : (
        <>
          <span>Add your Google Maps API key</span>
          <span style={{ fontSize: 11 }}>in the <code style={{ color: 'var(--orange)' }}>.env</code> file</span>
        </>
      )}
    </div>
  )
}

// Single-location map preview (used while only one endpoint is entered)
export function PlaceMap({ query, height = 220 }) {
  if (!hasKey()) return <Placeholder height={height} label={query ? `📍 ${query}` : undefined} />

  const src = `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${encodeURIComponent(query)}`
  return (
    <iframe
      title="Place map"
      src={src}
      width="100%"
      height={height}
      style={{ border: 'none', borderRadius: 10, display: 'block' }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  )
}

export default function RouteMap({ from, to, height = 220 }) {
  if (!hasKey()) {
    return <Placeholder height={height} label={from && to ? `🗺️ ${from} → ${to}` : undefined} />
  }

  const src = `https://www.google.com/maps/embed/v1/directions?key=${API_KEY}&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&mode=driving`

  return (
    <iframe
      title="Route map"
      src={src}
      width="100%"
      height={height}
      style={{ border: 'none', borderRadius: 10, display: 'block' }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  )
}
