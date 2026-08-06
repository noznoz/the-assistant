import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Icon from './Icon.jsx'
import { Button } from './primitives.jsx'
import { useT } from '../i18n/I18nProvider.jsx'

// ============================================================================
// In-app photo editor — crop (pan + zoom), rotate, and choose an aspect ratio,
// all on a canvas with no external dependencies. `usePhotoEditor()` returns an
// imperative `open(file|files, onEach, options)` plus the modal node to render;
// each picked image is edited in turn and the resulting JPEG File is handed to
// `onEach`. Non-image files pass straight through untouched.
//
//   const photo = usePhotoEditor()
//   ...onChange={e => photo.open(e.target.files, async f => { ... }, { aspect: 1 })}
//   ...{photo.node}
//
// options: { aspect?: number (w/h, default 1), round?: bool (circular mask),
//            size?: number (output long edge px, default 1400),
//            quality?: number (0..1, default 0.85), onComplete?: () => void }
// ============================================================================

const ASPECTS = [
  { id: 'square', label: '1:1', value: 1 },
  { id: 'r43', label: '4:3', value: 4 / 3 },
  { id: 'r32', label: '3:2', value: 3 / 2 },
  { id: 'r169', label: '16:9', value: 16 / 9 },
]

const coverScale = (nw, nh, fw, fh, rot) =>
  (rot % 180 === 0) ? Math.max(fw / nw, fh / nh) : Math.max(fw / nh, fh / nw)

// Keep the image covering the whole crop frame (no empty gaps at the edges).
function clampOffset(nw, nh, fw, fh, rot, S, x, y) {
  const rotated = rot % 180 !== 0
  const rw = (rotated ? nh : nw) * S
  const rh = (rotated ? nw : nh) * S
  const maxX = Math.max(0, (rw - fw) / 2)
  const maxY = Math.max(0, (rh - fh) / 2)
  return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) }
}

// Draw the current view. Frame is fw×fh CSS px; k maps frame px → target px.
function paint(ctx, img, fw, fh, rot, S, off, k) {
  ctx.clearRect(0, 0, fw * k, fh * k)
  ctx.save()
  ctx.translate((fw / 2 + off.x) * k, (fh / 2 + off.y) * k)
  ctx.rotate(rot * Math.PI / 180)
  const s = S * k
  ctx.scale(s, s)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  ctx.restore()
}

function PhotoEditorModal({ file, index, count, options, onApply, onOriginal, onCancel }) {
  const { t } = useT()
  const round = !!options.round
  const [img, setImg] = useState(null)
  const [aspect, setAspect] = useState(options.aspect || 1)
  const [rot, setRot] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef(null)
  const drag = useRef(null)

  // Crop-frame size: fit the chosen aspect inside a sensible stage.
  const { fw, fh } = useMemo(() => {
    const maxW = Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - 48, 400)
    const maxH = Math.min((typeof window !== 'undefined' ? window.innerHeight : 640) * 0.5, 420)
    let w = maxW, h = w / aspect
    if (h > maxH) { h = maxH; w = h * aspect }
    return { fw: Math.round(w), fh: Math.round(h) }
  }, [aspect])

  // Load the picked file into an <img>.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => setImg(im)
    im.onerror = () => onApply && onOriginal()  // undecodable → just use the file
    im.src = url
    return () => URL.revokeObjectURL(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // New image / rotation / aspect → recentre and reset zoom so we always start
  // from a clean "cover" fit.
  useEffect(() => { setZoom(1); setOff({ x: 0, y: 0 }) }, [img, rot, aspect])

  const base = img ? coverScale(img.naturalWidth, img.naturalHeight, fw, fh, rot) : 1
  const S = base * zoom

  // Repaint the preview whenever anything changes.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !img) return
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    c.width = fw * dpr; c.height = fh * dpr
    c.style.width = fw + 'px'; c.style.height = fh + 'px'
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, img, fw, fh, rot, S, off, 1)
  }, [img, fw, fh, rot, S, off])

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }
  }
  const onMove = (e) => {
    if (!drag.current || !img) return
    const nx = drag.current.ox + (e.clientX - drag.current.px)
    const ny = drag.current.oy + (e.clientY - drag.current.py)
    setOff(clampOffset(img.naturalWidth, img.naturalHeight, fw, fh, rot, S, nx, ny))
  }
  const onUp = () => { drag.current = null }
  const onWheel = (e) => {
    if (!img) return
    const z = Math.max(1, Math.min(6, zoom * (1 - e.deltaY * 0.0012)))
    setZoom(z)
  }
  const changeZoom = (z) => {
    setZoom(z)
    if (img) setOff(o => clampOffset(img.naturalWidth, img.naturalHeight, fw, fh, rot, base * z, o.x, o.y))
  }
  const reset = () => { setRot(0); setZoom(1); setOff({ x: 0, y: 0 }); setAspect(options.aspect || 1) }

  // Render the crop to an output canvas and hand back a JPEG File.
  const apply = async () => {
    if (!img) { onOriginal(); return }
    setBusy(true)
    try {
      const longEdge = options.size || 1400
      const outW = fw >= fh ? longEdge : Math.round(longEdge * (fw / fh))
      const outH = fw >= fh ? Math.round(longEdge * (fh / fw)) : longEdge
      const k = outW / fw
      const oc = document.createElement('canvas')
      oc.width = outW; oc.height = outH
      const ctx = oc.getContext('2d')
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, outW, outH)
      paint(ctx, img, fw, fh, rot, S, off, k)
      const quality = options.quality || 0.85
      const blob = await new Promise(res => oc.toBlob(res, 'image/jpeg', quality))
      if (!blob) { onOriginal(); return }
      const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
      onApply(new File([blob], name, { type: 'image/jpeg' }))
    } catch {
      onOriginal()
    } finally { setBusy(false) }
  }

  return (
    <div className="pe-overlay" role="dialog" aria-modal="true" aria-label={t('editPhoto')}>
      <div className="pe-panel">
        <div className="pe-head">
          <button className="iconbtn" aria-label={t('cancel')} onClick={onCancel}><Icon name="x" size={18} /></button>
          <div className="pe-title">{t('editPhoto')}{count > 1 ? ` · ${index + 1}/${count}` : ''}</div>
          <button className="iconbtn" aria-label={t('reset')} onClick={reset}><Icon name="refresh" size={17} /></button>
        </div>

        <div className="pe-stage" style={{ width: fw, height: fh }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
          <canvas ref={canvasRef} className="pe-canvas" />
          {!img && <div className="pe-loading"><Icon name="camera" size={22} /></div>}
          <div className={`pe-frame ${round ? 'round' : ''}`} aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </div>

        <div className="pe-zoom">
          <Icon name="search" size={15} />
          <input type="range" min="1" max="6" step="0.01" value={zoom}
            onChange={e => changeZoom(parseFloat(e.target.value))} aria-label={t('zoom')} />
        </div>

        <div className="pe-tools">
          <button className="pe-tool" onClick={() => setRot(r => (r + 270) % 360)} aria-label={`${t('rotate')} ⟲`}>
            <Icon name="refresh" size={16} style={{ transform: 'scaleX(-1)' }} /><span>{t('rotate')}</span>
          </button>
          <button className="pe-tool" onClick={() => setRot(r => (r + 90) % 360)} aria-label={`${t('rotate')} ⟳`}>
            <Icon name="refresh" size={16} /><span>{t('rotate')}</span>
          </button>
          {!round && ASPECTS.map(a => (
            <button key={a.id} className={`pe-tool ${Math.abs(aspect - a.value) < 0.001 ? 'on' : ''}`}
              onClick={() => setAspect(a.value)} aria-label={a.label}><span>{a.label}</span></button>
          ))}
        </div>

        <div className="pe-actions">
          <Button variant="ghost" onClick={onOriginal} disabled={busy}>{t('useOriginal')}</Button>
          <Button variant="primary" icon="check" onClick={apply} disabled={busy || !img}>{t('useThisPhoto')}</Button>
        </div>
      </div>
    </div>
  )
}

export function usePhotoEditor() {
  const [state, setState] = useState(null) // { files, idx, onEach, options }

  const open = useCallback((input, onEach, options = {}) => {
    const arr = input instanceof File ? [input] : Array.from(input || [])
    const isImg = (f) => f && f.type && f.type.startsWith('image/')
    arr.filter(f => !isImg(f)).forEach(f => onEach(f)) // non-images pass through
    const imgs = arr.filter(isImg)
    if (!imgs.length) { options.onComplete && options.onComplete(); return }
    setState({ files: imgs, idx: 0, onEach, options })
  }, [])

  const advance = useCallback(() => {
    setState(s => {
      if (!s) return null
      const next = s.idx + 1
      if (next >= s.files.length) { s.options.onComplete && s.options.onComplete(); return null }
      return { ...s, idx: next }
    })
  }, [])

  const apply = useCallback(async (fileOut) => {
    let cur
    setState(s => { cur = s; return s })
    if (cur) { await cur.onEach(fileOut); advance() }
  }, [advance])

  const node = state ? (
    <PhotoEditorModal
      key={state.idx}
      file={state.files[state.idx]}
      index={state.idx}
      count={state.files.length}
      options={state.options}
      onCancel={() => setState(null)}
      onOriginal={() => apply(state.files[state.idx])}
      onApply={apply}
    />
  ) : null

  return { open, node }
}
