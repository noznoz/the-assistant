// Voice capture via the Web Speech API. Support is patchy — desktop Chrome and
// Android work well; iOS Safari (and installed PWAs) often do not — so callers
// must feature-detect with speechSupported() and keep typing as the fallback.

export function speechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// Start a single dictation. Streams interim text via onResult(text, isFinal),
// then onEnd(finalText). Returns the recognition object (call .stop() to end),
// or null if unsupported.
export function listen({ lang = 'en-US', onResult, onEnd, onError } = {}) {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  if (!SR) { onError && onError('unsupported'); return null }
  let rec
  try { rec = new SR() } catch { onError && onError('init'); return null }
  rec.lang = lang
  rec.interimResults = true
  rec.maxAlternatives = 1
  rec.continuous = false
  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) finalText += r[0].transcript
      else interim += r[0].transcript
    }
    onResult && onResult((finalText + interim).trim(), !!finalText)
  }
  rec.onerror = (e) => onError && onError((e && e.error) || 'error')
  rec.onend = () => onEnd && onEnd(finalText.trim())
  try { rec.start() } catch { onError && onError('start'); return null }
  return rec
}
