import { useState, useEffect, useCallback } from 'react'

// Tiny hash-based router. Route shape: "tab" or "tab/detailId".
// Keeps navigation dependency-free and back-button friendly.
export function useRouter(initial = 'today') {
  const parse = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, '')) || initial
  const [route, setRoute] = useState(parse)

  useEffect(() => {
    const onHash = () => setRoute(parse())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = `#/${initial}`
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((r) => { window.location.hash = `#/${r}` }, [])
  const back = useCallback(() => window.history.back(), [])

  const [tab, ...rest] = route.split('/')
  return { route, tab, param: rest.join('/'), go, back }
}
