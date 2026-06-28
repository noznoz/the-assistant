import { useState } from 'react'

export default function Inbox({ currentRider, isAdmin, riders, messages, onSendMessage, onMarkRead, onDeleteMessage }) {
  const [section, setSection] = useState('inbox')   // 'inbox' | 'sent'
  const [composing, setComposing] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [sendToAll, setSendToAll] = useState(true)
  const [selectedRiders, setSelectedRiders] = useState([])
  const [riderSearch, setRiderSearch] = useState('')
  const [openMsg, setOpenMsg] = useState(null)

  const sort = list => [...list].sort((a, b) => b.id - a.id)

  const inbox = sort(messages.filter(m => m.type !== 'sent_message'))
  const sent  = sort(messages.filter(m => m.type === 'sent_message'))
  const list  = section === 'inbox' ? inbox : sent

  const otherRiders = riders.filter(r => r.name !== currentRider)
  const filteredRiders = riderSearch
    ? otherRiders.filter(r => r.name.toLowerCase().includes(riderSearch.toLowerCase()))
    : otherRiders

  function toggleRider(name) {
    setSelectedRiders(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
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

  function handleDelete(id) {
    onDeleteMessage(id)
    setOpenMsg(null)
  }

  // ── Message detail view ──────────────────────────────────────────────
  if (openMsg) {
    const msg = list.find(m => m.id === openMsg)
    if (!msg) { setOpenMsg(null); return null }
    const isSent = msg.type === 'sent_message'

    return (
      <div style={{ padding: 16 }}>
        <button
          onClick={() => setOpenMsg(null)}
          style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back
        </button>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{isSent ? 'To' : 'From'}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)', wordBreak: 'break-word' }}>
                {isSent
                  ? (msg.recipients?.length > 3
                      ? `${msg.recipients.slice(0, 3).join(', ')} +${msg.recipients.length - 3} more`
                      : (msg.recipients || []).join(', ') || 'All Riders')
                  : msg.from}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{msg.createdAt}</span>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)', marginBottom: 20 }}>{msg.text}</p>

          <button
            onClick={() => handleDelete(msg.id)}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8,
              border: '1px solid #c62828', color: '#ef5350',
              fontSize: 13, fontWeight: 600,
            }}
          >
            🗑 Delete Message
          </button>
        </div>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>MESSAGES</h2>
        {isAdmin && (
          <button
            onClick={() => { setComposing(v => !v); setSection('inbox') }}
            style={{ background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
          >
            + New Message
          </button>
        )}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', background: '#111', borderRadius: 10, padding: 3, marginBottom: 16 }}>
        {[['inbox', 'Inbox', inbox.filter(m => !m.read).length], ['sent', 'Sent', 0]].map(([id, label, badge]) => {
          const active = section === id
          return (
            <button
              key={id}
              onClick={() => { setSection(id); setComposing(false) }}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {label}
              {badge > 0 && (
                <span style={{ background: 'var(--orange)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Compose form — admin only */}
      {composing && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 12, letterSpacing: 1 }}>NEW MESSAGE</p>

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
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>{section === 'inbox' ? '📭' : '📤'}</p>
          <p style={{ fontSize: 14 }}>{section === 'inbox' ? 'No messages yet' : 'Nothing sent yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(msg => {
            const isSent = msg.type === 'sent_message'
            const recipientLabel = isSent
              ? (msg.recipients?.length > 2
                  ? `${msg.recipients.slice(0, 2).join(', ')} +${msg.recipients.length - 2} more`
                  : (msg.recipients || []).join(', ') || 'All Riders')
              : null

            return (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                style={{
                  background: 'var(--card)',
                  border: `1px solid ${(!isSent && !msg.read) ? 'var(--orange)' : 'var(--border)'}`,
                  borderRadius: 12, padding: 14, textAlign: 'left', display: 'block', width: '100%',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: (!isSent && !msg.read) ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!isSent && !msg.read && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block', flexShrink: 0 }} />
                    )}
                    {isSent ? `To: ${recipientLabel}` : `From: ${msg.from}`}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{msg.createdAt}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.text}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
