import React, { useState, useRef, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore, useSettings } from '../../store/StoreProvider.jsx'
import { callClaude } from '../../lib/ai.js'
import { buildAssistantContext } from '../../lib/assistantContext.js'

// The persona + guardrails. Data is injected fresh on every send so the
// assistant always reasons over the current snapshot.
function systemPrompt(data, settings, lang) {
  const ctx = buildAssistantContext(data, settings)
  const name = (settings.profile && settings.profile.fullName) || settings.name || 'the user'
  return [
    `You are "The Assistant", a concise, proactive personal assistant living inside ${name}'s private, offline-first personal-OS app.`,
    `You have read-only access to a snapshot of their data (below). Answer questions about their tasks, documents & expiries, vehicles, finances, family, prayer times, travel and property using that data.`,
    `Be brief and specific. Prefer bullet points for lists. Format money with the currency shown. Never invent data — if something isn't in the snapshot, say you don't have it and suggest where in the app they'd add it.`,
    lang === 'ar' ? 'Reply in Arabic.' : 'Reply in English.',
    `\n--- DATA SNAPSHOT ---\n${ctx}`,
  ].join('\n')
}

export default function AssistantScreen({ go }) {
  const { t, lang } = useT()
  const { data } = useStore()
  const { settings } = useSettings()
  const [messages, setMessages] = useState([]) // { role, content }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const taRef = useRef(null)

  const hasKey = !!settings.anthropicKey

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setError('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setBusy(true)
    try {
      const reply = await callClaude({
        apiKey: settings.anthropicKey,
        model: settings.aiModel,
        system: systemPrompt(data, settings, lang),
        messages: next.map(m => ({ role: m.role, content: m.content })),
        maxTokens: 2048,
      })
      setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      const msg = e.status === 401 ? t('aiKeyBad')
        : e.status === 429 ? t('aiRateLimited')
        : (e.message || t('aiError'))
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }
  const grow = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'
  }

  const suggestions = [t('aiSug1'), t('aiSug2'), t('aiSug3')]

  return (
    <>
      <DetailHeader title={t('assistant')} onBack={() => go('more')}
        right={messages.length > 0 && (
          <button className="iconbtn" aria-label={t('clearChat')} onClick={() => { setMessages([]); setError('') }}>
            <Icon name="refresh" size={18} />
          </button>
        )} />

      {!hasKey ? (
        <div className="screen">
          <Empty icon="sparkle" title={t('assistantTitle')} text={t('addKeyToStart')}
            action={<Button variant="primary" icon="cog" onClick={() => go('settings')}>{t('addKeyBtn')}</Button>} />
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="screen" style={{ paddingBottom: 150 }}>
            {messages.length === 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'grid', placeItems: 'center', padding: '18px 0 10px' }}>
                  <span className="lead t-brand" style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center' }}>
                    <Icon name="sparkle" size={26} />
                  </span>
                </div>
                <h2 className="center" style={{ margin: '4px 0 2px', fontSize: 19 }}>{t('assistantTitle')}</h2>
                <p className="center muted" style={{ margin: '0 0 16px', fontSize: 13 }}>{t('assistantHint')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.map((s, i) => (
                    <button key={i} className="card tight" style={{ textAlign: 'start', padding: '12px 14px', fontSize: 14, fontWeight: 550, cursor: 'pointer' }}
                      onClick={() => { setInput(s); setTimeout(() => taRef.current?.focus(), 0) }}>
                      <Icon name="sparkle" size={13} style={{ color: 'var(--brand-600)', marginInlineEnd: 8 }} />{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
                <div style={{
                  maxWidth: '86%', padding: '10px 13px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? 'var(--brand-600)' : 'var(--surface)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                  border: m.role === 'user' ? 0 : '1px solid var(--line)',
                  borderBottomRightRadius: m.role === 'user' ? 5 : 16,
                  borderBottomLeftRadius: m.role === 'user' ? 16 : 5,
                }}>{m.content}</div>
              </div>
            ))}

            {busy && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '8px 0' }}>
                <div className="card tight" style={{ padding: '10px 14px', color: 'var(--ink-3)', fontSize: 14 }}>
                  <span className="dots">{t('thinking')}…</span>
                </div>
              </div>
            )}
            {error && <p className="err" style={{ margin: '8px 2px' }}>{error}</p>}
          </div>

          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 'calc(60px + env(safe-area-inset-bottom))',
            maxWidth: 620, margin: '0 auto', zIndex: 25,
            background: 'var(--bg)', borderTop: '1px solid var(--line)',
            padding: '10px 14px', display: 'flex', alignItems: 'flex-end', gap: 8,
          }}>
            <textarea ref={taRef} className="textarea" rows={1} value={input} onChange={grow} onKeyDown={onKeyDown}
              placeholder={t('askAnything')} style={{ flex: 1, resize: 'none', minHeight: 42, maxHeight: 120, padding: '10px 12px' }} />
            <button className="fab" style={{ position: 'static', width: 44, height: 44, flexShrink: 0, opacity: input.trim() && !busy ? 1 : 0.5 }}
              aria-label={t('send')} onClick={send} disabled={!input.trim() || busy}>
              <Icon name="chevron" size={22} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </div>
        </>
      )}
    </>
  )
}
