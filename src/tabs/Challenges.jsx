import { useState, useRef } from 'react'
import { TROPHIES } from '../data/challenges.js'
import { RIDER_AVATARS } from '../data/posts.js'
import { uploadImage } from '../lib/upload.js'

const STATUS_BADGE = {
  invited:  { label: 'Invited',  color: 'var(--gold)' },
  joined:   { label: 'Joined',   color: '#7986cb' },
  awarded:  { label: '🏆 Awarded', color: '#4caf50' },
}

// Look up a rider's avatar from the live roster, falling back to the demo map.
function avatarFor(name, roster) {
  return roster.find(r => r.name === name)?.avatar || RIDER_AVATARS[name] || '🤘'
}

export default function Challenges({ currentRider, isAdmin, addNotification, challenges, addChallenge, updateChallenge, roster = [] }) {
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)

  if (creating) {
    return <CreateChallenge currentRider={currentRider} onCancel={() => setCreating(false)} onCreate={ch => { addChallenge(ch); setCreating(false); setSelected(ch.id) }} />
  }

  if (selected) {
    const ch = challenges.find(c => c.id === selected)
    if (!ch) { setSelected(null); return null }
    return (
      <ChallengeDetail
        challenge={ch}
        currentRider={currentRider}
        isAdmin={isAdmin}
        addNotification={addNotification}
        roster={roster}
        onBack={() => setSelected(null)}
        onUpdate={patch => updateChallenge(ch.id, patch)}
      />
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>🏆 CHALLENGES</h2>
        <button
          onClick={() => setCreating(true)}
          style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--orange)', borderRadius: 8, padding: '7px 14px' }}
        >+ New Challenge</button>
      </div>

      {challenges.map(ch => {
        const mine = ch.participants.find(p => p.riderName === currentRider)
        const awarded = ch.participants.filter(p => p.status === 'awarded')
        return (
          <button
            key={ch.id}
            onClick={() => setSelected(ch.id)}
            style={{
              width: '100%', textAlign: 'left',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, marginBottom: 12, overflow: 'hidden',
              opacity: ch.status === 'closed' ? 0.75 : 1,
            }}
          >
            {/* Award visual */}
            {ch.awardType === 'banner' && ch.bannerImage ? (
              <img src={ch.bannerImage} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ height: 90, background: 'linear-gradient(135deg, #2a1a0a, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                {ch.trophy}
              </div>
            )}

            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{ch.title}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                  background: ch.status === 'open' ? 'rgba(76,175,80,0.15)' : 'rgba(136,136,136,0.15)',
                  color: ch.status === 'open' ? '#4caf50' : 'var(--text-muted)',
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{ch.status}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 8 }}>🎁 {ch.prizeName}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>by {ch.creator}</span>
                <span>·</span>
                <span>{ch.participants.length} riders</span>
                {awarded.length > 0 && <><span>·</span><span style={{ color: '#4caf50' }}>{awarded.length} awarded</span></>}
                {mine && (
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: STATUS_BADGE[mine.status].color }}>
                    {STATUS_BADGE[mine.status].label}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

const EMPTY_FORM = { title: '', description: '', prizeName: '', deadline: '' }

function CreateChallenge({ currentRider, onCancel, onCreate }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [awardType, setAwardType] = useState('trophy')
  const [trophy, setTrophy] = useState('🏆')
  const [banner, setBanner] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const bannerRef = useRef()

  function handleBanner(e) {
    const file = e.target.files[0]
    if (!file) return
    setBannerFile(file)
    setBanner(URL.createObjectURL(file))
  }

  async function submit() {
    if (!form.title.trim() || !form.prizeName.trim() || busy) return
    setBusy(true)
    const bannerImage = awardType === 'banner' && bannerFile
      ? await uploadImage(bannerFile, 'challenges')
      : null
    await onCreate({
      id: Date.now(),
      title: form.title.trim(),
      description: form.description.trim(),
      creator: currentRider,
      awardType,
      trophy: awardType === 'trophy' ? trophy : '🏆',
      bannerImage,
      prizeName: form.prizeName.trim(),
      deadline: form.deadline.trim() || 'No deadline',
      status: 'open',
      participants: [{ riderName: currentRider, status: 'joined' }],
    })
    setBusy(false)
  }

  const labelStyle = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, letterSpacing: 0.5 }
  const fieldStyle = { width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onCancel} style={{ color: 'var(--orange)', fontSize: 14, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
        ‹ Cancel
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Create a Challenge</h2>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>CHALLENGE TITLE</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Most miles in July" style={fieldStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>DESCRIPTION / RULES</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="How is the winner decided?" rows={3} style={{ ...fieldStyle, resize: 'none' }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>PRIZE NAME</label>
        <input value={form.prizeName} onChange={e => setForm(f => ({ ...f, prizeName: e.target.value }))}
          placeholder="e.g. King of the Road" style={fieldStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>DEADLINE (optional)</label>
        <input value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
          placeholder="e.g. Jul 31, 2026" style={fieldStyle} />
      </div>

      {/* Award type toggle */}
      <label style={labelStyle}>THE AWARD</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['trophy', '🏆 Pick a Trophy'], ['banner', '📤 Upload Yours']].map(([type, label]) => (
          <button key={type} onClick={() => setAwardType(type)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: awardType === type ? 'var(--orange)' : 'var(--card)',
              color: awardType === type ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${awardType === type ? 'var(--orange)' : 'var(--border)'}`,
            }}>{label}</button>
        ))}
      </div>

      {awardType === 'trophy' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 24 }}>
          {TROPHIES.map(t => (
            <button key={t} onClick={() => setTrophy(t)}
              style={{
                aspectRatio: '1', fontSize: 26, borderRadius: 10,
                background: trophy === t ? 'rgba(255,107,0,0.2)' : 'var(--card)',
                border: `2px solid ${trophy === t ? 'var(--orange)' : 'var(--border)'}`,
              }}>{t}</button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBanner} />
          {banner ? (
            <div style={{ position: 'relative' }}>
              <img src={banner} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
              <button onClick={() => bannerRef.current.click()}
                style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12, padding: '5px 12px', borderRadius: 8 }}>
                Change
              </button>
            </div>
          ) : (
            <button onClick={() => bannerRef.current.click()}
              style={{ width: '100%', padding: '32px 0', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 30 }}>📤</span>
              Upload your own trophy photo
            </button>
          )}
        </div>
      )}

      <button onClick={submit}
        style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}>
        Launch Challenge
      </button>
    </div>
  )
}

function ChallengeDetail({ challenge, currentRider, isAdmin, addNotification, roster = [], onBack, onUpdate }) {
  const [showInvite, setShowInvite] = useState(false)
  const ch = challenge
  const isCreator = currentRider === ch.creator || isAdmin
  const me = ch.participants.find(p => p.riderName === currentRider)
  const notParticipants = roster
    .map(r => r.name)
    .filter(name => !ch.participants.some(p => p.riderName === name))

  function setParticipantStatus(riderName, status) {
    onUpdate({ participants: ch.participants.map(p => p.riderName === riderName ? { ...p, status } : p) })
  }

  function join() {
    if (me) setParticipantStatus(currentRider, 'joined')
    else onUpdate({ participants: [...ch.participants, { riderName: currentRider, status: 'joined' }] })
  }

  function invite(riderName) {
    onUpdate({ participants: [...ch.participants, { riderName, status: 'invited' }] })
    addNotification({
      id: Date.now() + Math.random(),
      rider: riderName,
      text: `${ch.creator} invited you to the challenge "${ch.title}" — win the ${ch.prizeName}! ${ch.awardType === 'trophy' ? ch.trophy : '🖼️'}`,
      time: 'just now',
      tab: 'challenges',
    })
    setShowInvite(false)
  }

  function award(riderName) {
    setParticipantStatus(riderName, 'awarded')
    addNotification({
      id: Date.now() + Math.random(),
      rider: riderName,
      text: `${ch.creator} awarded you "${ch.prizeName}" ${ch.awardType === 'trophy' ? ch.trophy : '🏆'} in the "${ch.title}" challenge! 🎉`,
      time: 'just now',
      tab: 'challenges',
    })
  }

  function revokeAward(riderName) {
    setParticipantStatus(riderName, 'joined')
  }

  function toggleStatus() {
    onUpdate({ status: ch.status === 'open' ? 'closed' : 'open' })
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={{ color: 'var(--orange)', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        ‹ Back
      </button>

      {/* Award visual */}
      {ch.awardType === 'banner' && ch.bannerImage ? (
        <img src={ch.bannerImage} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, display: 'block', marginBottom: 16 }} />
      ) : (
        <div style={{ height: 140, background: 'linear-gradient(135deg, #2a1a0a, #1a1a1a)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, marginBottom: 16 }}>
          {ch.trophy}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{ch.title}</h2>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, flexShrink: 0,
          background: ch.status === 'open' ? 'rgba(76,175,80,0.15)' : 'rgba(136,136,136,0.15)',
          color: ch.status === 'open' ? '#4caf50' : 'var(--text-muted)',
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{ch.status}</span>
      </div>

      <div style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>🎁 {ch.prizeName}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Created by {ch.creator} · 📅 {ch.deadline}
      </div>

      {ch.description && (
        <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
          {ch.description}
        </p>
      )}

      {/* My action */}
      {ch.status === 'open' && (
        <div style={{ marginBottom: 20 }}>
          {!me && (
            <button onClick={join}
              style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}>
              🏍️ Join This Challenge
            </button>
          )}
          {me?.status === 'invited' && (
            <button onClick={join}
              style={{ width: '100%', background: 'var(--gold)', color: '#111', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}>
              ✋ Accept Invite & Join
            </button>
          )}
          {me?.status === 'joined' && (
            <div style={{ background: 'rgba(121,134,203,0.12)', border: '1px solid #7986cb', borderRadius: 10, padding: 13, textAlign: 'center', fontSize: 14, color: '#7986cb', fontWeight: 600 }}>
              ✓ You're in — waiting on the creator to award the prize
            </div>
          )}
          {me?.status === 'awarded' && (
            <div style={{ background: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', borderRadius: 10, padding: 13, textAlign: 'center', fontSize: 14, color: '#4caf50', fontWeight: 700 }}>
              {ch.awardType === 'trophy' ? ch.trophy : '🏆'} You earned "{ch.prizeName}"!
            </div>
          )}
        </div>
      )}

      {/* Participants */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>RIDERS ({ch.participants.length})</p>
        {isCreator && notParticipants.length > 0 && (
          <button onClick={() => setShowInvite(v => !v)}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 6, padding: '4px 10px' }}>
            + Invite Riders
          </button>
        )}
      </div>

      {/* Invite picker */}
      {showInvite && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, marginBottom: 12 }}>
          {notParticipants.map(r => (
            <button key={r} onClick={() => invite(r)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>{avatarFor(r, roster)}</span>
              <span style={{ fontSize: 14, flex: 1 }}>{r}</span>
              <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>Invite</span>
            </button>
          ))}
        </div>
      )}

      {ch.participants.map(p => {
        const badge = STATUS_BADGE[p.status]
        const canAward = isCreator && p.status === 'joined'
        const canRevoke = isCreator && p.status === 'awarded'
        return (
          <div key={p.riderName} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 8,
          }}>
            <span style={{ fontSize: 26 }}>{avatarFor(p.riderName, roster)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {p.riderName}
                {p.riderName === ch.creator && <span style={{ fontSize: 9, color: 'var(--gold)', marginLeft: 6, fontWeight: 700 }}>CREATOR</span>}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: badge.color }}>{badge.label}</div>
            </div>
            {canAward && (
              <button onClick={() => award(p.riderName)}
                style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#4caf50', borderRadius: 8, padding: '6px 12px' }}>
                Award {ch.awardType === 'trophy' ? ch.trophy : '🏆'}
              </button>
            )}
            {canRevoke && (
              <button onClick={() => revokeAward(p.riderName)}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                Revoke
              </button>
            )}
          </div>
        )
      })}

      {/* Creator controls */}
      {isCreator && (
        <button onClick={toggleStatus}
          style={{ width: '100%', marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: 11 }}>
          {ch.status === 'open' ? '🔒 Close Challenge' : '🔓 Reopen Challenge'}
        </button>
      )}
    </div>
  )
}
