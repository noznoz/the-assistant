import { useEffect, useRef } from 'react'
import { loadGoogleMaps, hasMapsKey } from '../lib/googleMaps.js'

// A text input enhanced with Google Places Autocomplete.
// If no Maps key is configured it behaves as a plain text input.
export default function PlaceInput({ value, onChange, placeholder, style }) {
  const ref = useRef()

  useEffect(() => {
    if (!hasMapsKey() || !ref.current) return
    let autocomplete
    let cancelled = false

    loadGoogleMaps().then(google => {
      if (cancelled || !ref.current) return
      autocomplete = new google.maps.places.Autocomplete(ref.current, {
        fields: ['name', 'formatted_address'],
      })
      autocomplete.addListener('place_changed', () => {
        const p = autocomplete.getPlace()
        const addr = p.formatted_address || ''
        const name = p.name || ''
        // Prefer "Name, Address" unless the address already starts with the name
        const text = name && addr && !addr.startsWith(name) ? `${name}, ${addr}` : (addr || name || ref.current.value)
        onChange(text)
      })
    }).catch(() => {})

    return () => {
      cancelled = true
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={style}
    />
  )
}
