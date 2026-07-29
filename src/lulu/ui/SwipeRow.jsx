import React, { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { useT } from '../i18n/I18nProvider.jsx'

// Wraps a list row so a horizontal swipe (left) reveals Edit / Delete actions.
// Works with pointer events (touch + mouse). Vertical drags fall through to
// native scrolling. A swipe suppresses the row's own tap; when open, a tap on
// the row closes it instead of activating it.
export default function SwipeRow({ onEdit, onDelete, editLabel, deleteLabel, children }) {
  const { t } = useT()
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const open = useRef(false)
  const start = useRef(null)
  const axis = useRef(null)      // 'x' | 'y' | null (undecided)
  const swiped = useRef(false)

  const width = (onEdit ? 76 : 0) + (onDelete ? 76 : 0)
  if (!width) return children

  const down = (e) => {
    start.current = { x: e.clientX, y: e.clientY, base: open.current ? -width : 0 }
    axis.current = null
    swiped.current = false
  }
  const move = (e) => {
    if (!start.current) return
    const ddx = e.clientX - start.current.x
    const ddy = e.clientY - start.current.y
    if (!axis.current) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y'
      if (axis.current === 'x') {
        setDragging(true)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      }
    }
    if (axis.current !== 'x') return
    swiped.current = true
    const next = Math.max(-width - 16, Math.min(0, start.current.base + ddx))
    setDx(next)
  }
  const up = () => {
    if (start.current && axis.current === 'x') {
      const shouldOpen = dx < -width / 2
      open.current = shouldOpen
      setDx(shouldOpen ? -width : 0)
    }
    start.current = null
    setDragging(false)
  }
  const close = () => { open.current = false; setDx(0) }

  // Intercept the row's click when we just swiped, or to close when open.
  const clickCapture = (e) => {
    if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; return }
    if (open.current) { e.preventDefault(); e.stopPropagation(); close() }
  }

  const act = (fn) => (e) => { e.stopPropagation(); close(); fn && fn() }

  return (
    <div className="swipe-wrap">
      <div className="swipe-actions" style={{ width }}>
        {onEdit && <button className="edit" onClick={act(onEdit)} aria-label={editLabel || t('edit')}>
          <Icon name="cog" size={17} /><span>{editLabel || t('edit')}</span>
        </button>}
        {onDelete && <button className="del" onClick={act(onDelete)} aria-label={deleteLabel || t('delete')}>
          <Icon name="trash" size={17} /><span>{deleteLabel || t('delete')}</span>
        </button>}
      </div>
      <div className="swipe-content" style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform .2s var(--ease)' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={clickCapture}>
        {children}
      </div>
    </div>
  )
}
