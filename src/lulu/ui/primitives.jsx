import React, { useEffect, useState, useCallback } from 'react'
import Icon from './Icon.jsx'
import { useT } from '../i18n/I18nProvider.jsx'

// ---------- Button ----------
export function Button({ variant = '', size = '', block, icon, children, ...rest }) {
  return (
    <button className={`btn ${variant} ${size} ${block ? 'block' : ''}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  )
}

// ---------- Card ----------
export function Card({ tight, flat, className = '', children, ...rest }) {
  return <div className={`card ${tight ? 'tight' : ''} ${flat ? 'flat' : ''} ${className}`} {...rest}>{children}</div>
}

// ---------- Section heading ----------
export function Section({ title, count, action, onAction }) {
  return (
    <div className="section-h">
      <h2>{title}</h2>
      {count != null && <span className="count">{count}</span>}
      <span className="spacer" />
      {action && <button className="link-btn" onClick={onAction}>{action}</button>}
    </div>
  )
}

// ---------- Chip ----------
export function Chip({ on, selectable, tint = '', dot, onClick, children }) {
  return (
    <span className={`chip ${tint} ${selectable ? 'selectable' : ''} ${on ? 'on' : ''}`} onClick={onClick}>
      {dot && <span className="dot" style={{ background: dot }} />}
      {children}
    </span>
  )
}

// ---------- Field wrapper ----------
export function Field({ label, required, hint, error, children }) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span className="req"> *</span>}</label>}
      {children}
      {error ? <div className="err">{error}</div> : hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export const Input = (p) => <input className="input" {...p} />
export const TextArea = (p) => <textarea className="textarea" {...p} />
export function Select({ options, children, ...p }) {
  return (
    <select className="select" {...p}>
      {children}
      {options && options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ---------- Segmented control ----------
export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Empty state ----------
export function Empty({ icon = 'sparkle', title, text, action }) {
  return (
    <div className="empty">
      <div className="ic"><Icon name={icon} size={32} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

// ---------- Progress ring ----------
export function Ring({ value = 0, size = 64, stroke = 7, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.max(0, Math.min(1, value)) * c)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg className="ring" width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="val" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 750, fontSize: 15 }}>
        {children}
      </div>
    </div>
  )
}

// ---------- Stat tile ----------
export function Stat({ label, value, sub, onClick }) {
  return (
    <div className="stat" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="k">{label}</div>
      <div className="v tnum">{value}{sub && <small> {sub}</small>}</div>
    </div>
  )
}

// ---------- Bottom sheet / modal ----------
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-h">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="close"><Icon name="x" size={18} /></button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Toast (imperative-ish via hook) ----------
export function useToast() {
  const [msg, setMsg] = useState(null)
  const show = useCallback((m) => {
    setMsg(m)
    window.clearTimeout(show._t)
    show._t = window.setTimeout(() => setMsg(null), 2200)
  }, [])
  const node = msg ? <div className="toast">{msg}</div> : null
  return { show, node }
}

// ---------- Simple horizontal bar chart ----------
export function Bars({ data, format = (v) => v }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || 'var(--brand-500)' }} /></span>
          <b className="tnum" style={{ fontSize: 13 }}>{format(d.value)}</b>
        </div>
      ))}
    </div>
  )
}

// ---------- Reusable "add" FAB ----------
export function Fab({ onClick, icon = 'plus' }) {
  return <button className="fab" onClick={onClick} aria-label="add"><Icon name={icon} size={26} /></button>
}

// ---------- Priority dot ----------
export function PriorityDot({ color }) {
  return <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />
}

// A small helper header used on stacked/detail screens.
export function DetailHeader({ title, onBack, right }) {
  const { t } = useT()
  return (
    <div className="topbar">
      <button className="iconbtn" onClick={onBack} aria-label={t('back')}><Icon name="chevronL" size={18} /></button>
      <h1 style={{ fontSize: 18 }}>{title}</h1>
      {right}
    </div>
  )
}
