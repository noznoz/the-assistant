// A real, audible alarm for reminders/alerts that come due while the app is
// open (or on reopen). The tone is synthesized with the Web Audio API — no
// asset to bundle or fetch — and we buzz the vibration motor where supported.
//
// Browsers gate audio until the user has interacted with the page, so call
// unlockAudio() once from a user gesture (a tap) to warm up the context; after
// that a timer-fired playAlarm() works. Everything is wrapped so a device
// without Web Audio (or with autoplay blocked) simply stays silent.

let ctx = null
let unlocked = false

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) { try { ctx = new AC() } catch { return null } }
  return ctx
}

// Resume the audio context inside a user gesture so later timer-fired alarms
// are allowed to sound. Safe to call repeatedly.
export function unlockAudio() {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  unlocked = true
}

export function audioReady() {
  const c = getCtx()
  return !!c && (unlocked || c.state === 'running')
}

// Play a short, attention-getting two-note alarm (repeated), plus a vibration.
// `volume` 0–1. Returns true if it attempted to sound.
export function playAlarm({ volume = 0.35, cycles = 2 } = {}) {
  try {
    if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 250])
    const c = getCtx()
    if (!c) return false
    if (c.state === 'suspended') c.resume().catch(() => {})
    const start = c.currentTime + 0.02
    // Each cycle: a rising pair of chimes (A5 → C#6), gently decaying.
    const notes = []
    for (let i = 0; i < cycles; i++) {
      const base = i * 0.62
      notes.push({ f: 880.0, at: base }, { f: 1108.7, at: base + 0.22 })
    }
    for (const n of notes) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = n.f
      osc.connect(gain); gain.connect(c.destination)
      const t0 = start + n.at
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), t0 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
      osc.start(t0)
      osc.stop(t0 + 0.34)
    }
    return true
  } catch {
    return false
  }
}
