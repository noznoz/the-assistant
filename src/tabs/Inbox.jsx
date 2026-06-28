import { useState } from 'react'

export default function Inbox({ currentRider, isAdmin, riders, messages, onSendMessage, onMarkRead }) {
  const [composing, setComposing] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [sendToAll, setSendToAll] = useState(true)
  const [selectedRiders, setSelectedRiders] = useState([])
  const [riderSearch, setRiderSearch] = useState('')
  const [openMsg, setOpenMsg] = useState(null)

  const myMessages = [...messages]
    .filter(m => m.rider === currentRider)
    .sort((a, b) => (String(b.id) > String(a.id) ? 1 : -1))

  const otherRiders = riders.filter(r => r.name !== currentRider)
  const filteredRiders = riderSearch
    ? otherRiders.filter(r => r.name.toLowerCase().includes(riderSearch.toLowerCase()))
    : otherRiders

  function toggleRider(name) {
    setSelectedRiders(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function handleSend() {
    if (!composeText.trim()) return
    const recipients = sendToAll ? otherRiders.map(r => r.name) : selectedRiders
    if (recipients.length === 0) return
    onSendMessage({ text: composeText.trim(), recipients, from: currentRider })
    setComposeText('')
    setSelectedRiders([])
    setRiderSearch('')
    setComposing(false)
  }

  function openMessage(msg) {
    setOpenMsg(msg.id)
    if (!msg.read) onMarkRead(msg.id)
  }

  if (openMsg) {
    const msg = myMessages.find(m => m.id === openMsg)
    return (
      <div style={{ padding: 16 }}>
        <button
          onClick={() => setOpenMsg(null)}
          style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Inbox
        </button>
        {msg && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 8 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>From</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)' }}>{msg.from}</p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{msg.createdAt}</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{msg.text}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>INBOX</h2>
        {isAdmin && (
          <button
            onClick={() => setComposing(v => !v)}
            style={{ background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
          >
            + New Message
          </button>
        )}
      </div>

      {/* Compose form — admin only */}
      {composing && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 12, letterSpacing: 1 }}>NEW MESSAGE</p>

          {/* Send to: All / Select */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Send to</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['All Riders', 'Select Riders'].map((label, i) => {
                const active = sendToAll === (i === 0)
                return (
                  <button
                    key={label}
                    onClick={() => setSendToAll(i === 0)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 600, fontSize: 12,
                      background: active ? 'var(--orange)' : '#111',
                      color: active ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
                    }}
                  >{label}</button>
                )
              })}
            </div>
          </div>

          {/* Rider picker */}
          {!sendToAll && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={riderSearch}
                onChange={e => setRiderSearch(e.target.value)}
                placeholder="Search riders..."
                style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, marginBottom: 8 }}
              />
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredRiders.map(r => {
                  const sel = selectedRiders.includes(r.name)
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleRider(r.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8, textAlign: 'left',
                        background: sel ? 'rgba(255,107,0,0.12)' : '#111',
                        border: `1px solid ${sel ? 'var(--orange)' : 'var(--border)'}`,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{r.avatar || '👤'}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{r.name}</span>
                      {sel && <span style={{ color: 'var(--orange)', fontWeight: 700 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
              {selectedRiders.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--orange)', marginTop: 6 }}>
                  {selectedRiders.length} rider{selectedRiders.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Message text */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Message</label>
            <textarea
              value={composeText}
              onChange={e => setComposeText(e.target.value)}
              rows={3}
              placeholder="Type your message..."
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSend}
              disabled={!composeText.trim() || (!sendToAll && selectedRiders.length === 0)}
              style={{
                flex: 1, background: 'var(--orange)', color: '#fff', fontWeight: 600,
                fontSize: 13, padding: '10px 0', borderRadius: 8,
                opacity: (!composeText.trim() || (!sendToAll && selectedRiders.length === 0)) ? 0.5 : 1,
              }}
            >
              Send
            </button>
            <button
              onClick={() => { setComposing(false); setComposeText(''); setSelectedRiders([]); setRiderSearch('') }}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message list */}
      {myMessages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>✉️</p>
          <p style={{ fontSize: 14 }}>No messages yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myMessages.map(msg => (
            <button
              key={msg.id}
              onClick={() => openMessage(msg)}
              style={{
                background: 'var(--card)',
                border: `1px solid ${msg.read ? 'var(--border)' : 'var(--orange)'}`,
                borderRadius: 12, padding: 14, textAlign: 'left',
                display: 'block', width: '100%',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: msg.read ? 500 : 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!msg.read && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block', flexShrink: 0 }} />
                  )}
                  {msg.from}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{msg.createdAt}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
