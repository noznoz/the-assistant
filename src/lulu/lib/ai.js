// ============================================================================
// Claude API — bring-your-own-key, called directly from the browser.
//
// The key is stored only on this device (localStorage via settings) and sent
// straight to api.anthropic.com — there is no server in between. This keeps the
// app fully offline-first: with no key set, nothing here runs and everything
// else in the app still works.
// ============================================================================

export const AI_MODELS = [
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — balanced (recommended)' },
  { id: 'claude-opus-5', label: 'Opus 5 — smartest' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest & cheapest' },
]

export const DEFAULT_MODEL = 'claude-sonnet-5'

// One round-trip to the Messages API. Returns the assistant's text.
// Throws Error with .status on HTTP / network failure so the UI can explain it.
export async function callClaude({ apiKey, model, system, messages, maxTokens = 2048, signal }) {
  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required for direct browser use (opts into CORS on the API).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages,
      }),
      signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    const err = new Error('Network error — check your connection and try again.')
    err.status = 0
    throw err
  }

  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.error?.message || '' } catch { /* ignore */ }
    const err = new Error(detail || `Request failed (${res.status}).`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  if (data.stop_reason === 'refusal') return "I'm sorry — I wasn't able to help with that request."
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
  return text || '…'
}
