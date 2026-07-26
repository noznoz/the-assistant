import React, { useState, useEffect } from 'react'
import Icon from './Icon.jsx'

// A 4-digit passcode pad. Calls onComplete(pin) when 4 digits are entered.
// `error` (bump text) shakes and clears the dots. Optional Face ID button.
export default function PinPad({ title, subtitle, onComplete, error, onFaceId, faceIdLabel }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (error) { setShake(true); setPin(''); const t = setTimeout(() => setShake(false), 400); return () => clearTimeout(t) }
  }, [error])

  const press = (d) => {
    setPin(prev => {
      if (prev.length >= 4) return prev
      const next = prev + d
      // On the 4th digit, submit then clear the pad so it's ready for the next
      // entry (e.g. the confirm step, or a retry after a wrong code).
      if (next.length === 4) setTimeout(() => { onComplete(next); setPin('') }, 120)
      return next
    })
  }
  const back = () => setPin(prev => prev.slice(0, -1))

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'face', '0', 'back']

  return (
    <div className="pinpad">
      <h2>{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
      <div className={`pin-dots ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map(i => <span key={i} className={`pin-dot ${i < pin.length ? 'on' : ''}`} />)}
      </div>
      {error && <div className="pin-err">{error}</div>}
      <div className="pin-keys">
        {keys.map(k => {
          if (k === 'face') return onFaceId
            ? <button key={k} className="pin-key ghost" onClick={onFaceId} aria-label={faceIdLabel}><Icon name="shield" size={24} /></button>
            : <span key={k} />
          if (k === 'back') return <button key={k} className="pin-key ghost" onClick={back} aria-label="delete"><Icon name="chevronL" size={24} /></button>
          return <button key={k} className="pin-key" onClick={() => press(k)}>{k}</button>
        })}
      </div>
    </div>
  )
}
