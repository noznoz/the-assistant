import { useEffect, useRef, useState } from 'react'

export const PULL_THRESHOLD = 65
const MAX_PULL = 90

export function usePullToRefresh(containerRef, onRefresh) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)
  const isPullingRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !onRefresh) return

    function onTouchStart(e) {
      // Only track gesture if we're at the very top of the scroll container.
      // Check once here — don't re-check in touchmove (iOS gets this wrong).
      if (el.scrollTop <= 1) {
        startY.current = e.touches[0].clientY
        isPullingRef.current = false
      } else {
        startY.current = null
      }
    }

    function onTouchMove(e) {
      if (startY.current === null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current

      if (dy > 5) {
        isPullingRef.current = true
        // Prevent native iOS overscroll/bounce while pulling
        e.preventDefault()
        const dist = Math.min(dy * 0.45, MAX_PULL)
        pullRef.current = dist
        setPullDistance(dist)
      } else if (dy < -5 && !isPullingRef.current) {
        // User scrolled up before pulling — cancel tracking
        startY.current = null
        pullRef.current = 0
        setPullDistance(0)
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return
      startY.current = null
      isPullingRef.current = false

      const dist = pullRef.current
      pullRef.current = 0

      if (dist >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDistance(0)
        try {
          await onRefresh()
        } finally {
          refreshingRef.current = false
          setRefreshing(false)
        }
      } else {
        setPullDistance(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [containerRef, onRefresh])

  return { pullDistance, refreshing }
}
