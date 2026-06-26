const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

export function hasMapsKey() {
  return !!KEY && KEY !== 'YOUR_API_KEY_HERE'
}

let loaderPromise = null

// Load the Google Maps JS SDK (with Places library) once, on demand.
export function loadGoogleMaps() {
  if (!hasMapsKey()) return Promise.reject(new Error('No Google Maps key'))
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&loading=async`
    s.async = true
    s.defer = true
    s.onload = () => resolve(window.google)
    s.onerror = () => { loaderPromise = null; reject(new Error('Failed to load Google Maps')) }
    document.head.appendChild(s)
  })
  return loaderPromise
}
