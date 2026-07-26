import { useState, useRef, useEffect } from 'react'

// Native-feeling pull-to-refresh for the document scroll. Engages only when the
// page is at the very top, the drag is mostly vertical, and no sheet is open.
// `onRefresh` should return a promise; the spinner shows until it resolves.
export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const startX = useRef(0)
  const pullRef = useRef(0)
  const busyRef = useRef(false)

  useEffect(() => {
    const THRESHOLD = 72
    const MAX = 120
    const DAMP = 0.5
    const setP = (v) => { pullRef.current = v; setPull(v) }

    const onStart = (e) => {
      if (busyRef.current) return
      if (window.scrollY > 0) return
      if (document.querySelector('.scrim')) return   // a bottom sheet is open
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX
    }

    const onMove = (e) => {
      if (startY.current == null || busyRef.current) return
      const dy = e.touches[0].clientY - startY.current
      const dx = e.touches[0].clientX - startX.current
      if (window.scrollY > 0 || dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        if (pullRef.current) setP(0)
        return
      }
      setP(Math.min(MAX, dy * DAMP))
      if (e.cancelable) e.preventDefault()   // stop the rubber-band while pulling
    }

    const onEnd = async () => {
      if (startY.current == null) return
      startY.current = null
      if (pullRef.current >= THRESHOLD && !busyRef.current) {
        busyRef.current = true
        setRefreshing(true)
        setP(THRESHOLD)
        try { await onRefresh() } catch { /* ignore */ }
        busyRef.current = false
        setRefreshing(false)
        setP(0)
      } else {
        setP(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh])

  return { pull, refreshing }
}
