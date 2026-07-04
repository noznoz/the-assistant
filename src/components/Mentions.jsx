import { useState, useRef } from 'react'

// @-mention utilities shared by the feed and trip discussions.

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Rider names mentioned in `text` via "@Name" (case-insensitive; names may contain spaces).
export function findMentions(text, names) {
  if (!text) return []
  const lower = text.toLowerCase()
  return names.filter(name => lower.includes('@' + name.toLowerCase()))
}

// Text with "@Name" mentions highlighted.
export function MentionText({ text, names = [], style }) {
  if (!text) return null
  if (!names.length) return <p style={style}>{text}</p>
  const pattern = new RegExp(`@(${names.map(escapeRe).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <p style={style}>
      {parts.map((part, i) => i % 2 === 1
        ? <span key={i} style={{ color: 'var(--orange)', fontWeight: 600 }}>@{part}</span>
        : part
      )}
    </p>
  )
}

// Input/textarea that pops rider-name suggestions while typing "@…".
// Accepts the same value/onChange contract as a plain input.
export function MentionInput({ value, onChange, names = [], textarea = false, containerStyle, style, ...rest }) {
  const [sugg, setSugg] = useState([])
  const ref = useRef(null)

  function refresh(text, caret) {
    const upto = text.slice(0, caret)
    const m = /@([^@\n]*)$/.exec(upto)
    if (!m) { setSugg([]); return }
    const q = m[1].toLowerCase()
    const matches = names
      .filter(n => n.toLowerCase().startsWith(q) && q.length < n.length)
      .slice(0, 4)
      .map(name => ({ name, start: m.index, end: caret }))
    setSugg(matches)
  }

  function handleChange(e) {
    onChange(e)
    refresh(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  function pick(s) {
    const next = value.slice(0, s.start) + '@' + s.name + ' ' + value.slice(s.end)
    onChange({ target: { value: next } })
    setSugg([])
    setTimeout(() => ref.current?.focus(), 0)
  }

  const Field = textarea ? 'textarea' : 'input'
  return (
    <div style={{ position: 'relative', ...containerStyle }}>
      <Field ref={ref} value={value} onChange={handleChange} style={style} {...rest} />
      {sugg.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, marginBottom: 4, overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {sugg.map(s => (
            <button key={s.name} onMouseDown={e => { e.preventDefault(); pick(s) }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, color: 'var(--text)', display: 'block' }}>
              <span style={{ color: 'var(--orange)', fontWeight: 700 }}>@</span> {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
