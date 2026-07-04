import { useState, useRef } from 'react'
import { RIDER_AVATARS } from '../data/posts.js'
import { uploadImage } from '../lib/upload.js'
import Avatar from '../components/Avatar.jsx'
import { MentionInput, MentionText, findMentions } from '../components/Mentions.jsx'


const TAG_COLORS = {
  'ride report': { bg: '#1a2a1a', color: '#4caf50' },
  'build':       { bg: '#1a1a2a', color: '#7986cb' },
  'event':       { bg: '#2a1a0a', color: 'var(--gold)' },
}

function PostCard({ post, currentRider, isAdmin, onAddReply, onLike, onDelete, onEdit, onDeleteReply, roster = [] }) {
  const byName = Object.fromEntries(roster.map(r => [r.name, r]))
  const names = roster.map(r => r.name)
  const [showReplies, setShowReplies] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.text)
  const [lightbox, setLightbox] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef()

  async function saveImage() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(post.image)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'road-heaven-photo.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(post.image, '_blank')
    }
    setSaving(false)
  }

  function submitReply() {
    if (!replyText.trim()) return
    onAddReply(post.id, replyText.trim())
    setReplyText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitReply()
    }
  }

  function saveEdit() {
    if (editText.trim()) onEdit(post.id, editText.trim())
    setEditing(false)
  }

  return (
    <>
    {lightbox && (
      <div
        onClick={() => setLightbox(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <button
          onClick={() => setLightbox(false)}
          style={{
            position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', right: 16,
            fontSize: 22, color: '#fff', background: 'rgba(255,255,255,0.15)',
            borderRadius: '50%', width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        <img
          src={post.image}
          alt="Post"
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '100%', maxHeight: 'calc(100dvh - 120px)',
            objectFit: 'contain', borderRadius: 6,
          }}
        />

        <button
          onClick={e => { e.stopPropagation(); saveImage() }}
          style={{
            position: 'absolute', bottom: 'calc(24px + env(safe-area-inset-bottom))',
            background: saving ? '#555' : 'var(--orange)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            padding: '12px 32px', borderRadius: 28,
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}
        >{saving ? 'Saving…' : '⬇ Save Photo'}</button>
      </div>
    )}
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${isAdmin ? 'rgba(255,107,0,0.2)' : 'var(--border)'}`,
      borderRadius: 12, marginBottom: 12,
    }}>
      {/* Post header */}
      <div style={{ padding: 16, paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar rider={byName[post.rider]} emoji={post.avatar} size={40} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{post.rider}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{post.time}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {TAG_COLORS[post.tag] && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                padding: '3px 8px', borderRadius: 6, letterSpacing: 0.5,
                textTransform: 'uppercase', ...TAG_COLORS[post.tag],
              }}>{post.tag}</span>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditText(post.text) }}
                  title="Edit post"
                  style={{ fontSize: 14, color: 'var(--gold)', padding: '2px 6px', borderRadius: 6, background: 'rgba(255,184,0,0.1)' }}
                >✏️</button>
                <button
                  onClick={() => onDelete(post.id)}
                  title="Delete post"
                  style={{ fontSize: 14, color: '#e53935', padding: '2px 6px', borderRadius: 6, background: 'rgba(229,57,53,0.1)' }}
                >🗑️</button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div style={{ marginBottom: 10 }}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={3}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--orange)',
                borderRadius: 8, padding: 10, color: 'var(--text)', fontSize: 14,
                resize: 'none', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={saveEdit}
                style={{ background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 12, padding: '5px 14px', borderRadius: 8 }}
              >Save</button>
              <button
                onClick={() => setEditing(false)}
                style={{ color: 'var(--text-muted)', fontSize: 12, padding: '5px 10px' }}
              >Cancel</button>
            </div>
          </div>
        ) : (
          post.text && (
            <MentionText text={post.text} names={names}
              style={{ fontSize: 14, lineHeight: 1.6, color: '#ddd', marginBottom: post.image ? 10 : 0 }} />
          )
        )}

        {post.image && (
          <img
            src={post.image}
            alt="Post"
            onClick={() => setLightbox(true)}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%', maxHeight: 260, objectFit: 'cover',
              borderRadius: 8, marginTop: 10, display: 'block',
              cursor: 'pointer',
            }}
          />
        )}
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 20, borderTop: '1px solid var(--border)', padding: '10px 16px', alignItems: 'center', marginTop: 12 }}>
        <button
          onClick={() => onLike(post.id)}
          style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          🔥 <span>{post.likes}</span>
        </button>
        <button
          onClick={() => { setShowReplies(v => !v); setTimeout(() => inputRef.current?.focus(), 100) }}
          style={{
            color: showReplies ? 'var(--orange)' : 'var(--text-muted)',
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          💬 <span>{post.replies.length}</span>
        </button>

      </div>

      {/* Replies section */}
      {showReplies && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: '0 0 12px 12px' }}>
          {post.replies.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>No replies yet. Be the first.</p>
          )}
          {post.replies.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
              <Avatar rider={byName[r.rider]} emoji={r.avatar} size={32} border="var(--border)" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.rider}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.time}</span>
                </div>
                <MentionText text={r.text} names={names}
                  style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }} />
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDeleteReply(post.id, r.id)}
                  title="Delete reply"
                  style={{ fontSize: 12, color: '#e53935', padding: '2px 5px', borderRadius: 5, background: 'rgba(229,57,53,0.1)', flexShrink: 0 }}
                >🗑️</button>
              )}
            </div>
          ))}

          {/* Reply input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Avatar rider={byName[currentRider]} emoji={RIDER_AVATARS[currentRider]} size={32} />
            <MentionInput
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              names={names}
              onKeyDown={handleKeyDown}
              placeholder={`Reply as ${currentRider.split(' ')[0]}… (@ to tag)`}
              containerStyle={{ flex: 1 }}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '8px 14px', color: 'var(--text)', fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={submitReply}
              disabled={!replyText.trim()}
              style={{
                background: replyText.trim() ? 'var(--orange)' : 'var(--border)',
                color: '#fff', fontWeight: 700, fontSize: 13,
                padding: '7px 14px', borderRadius: 20,
                transition: 'background 0.15s',
              }}
            >Send</button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default function Feed({ currentRider, isAdmin, addNotification, posts, addPost, updatePost, removePost, roster = [] }) {
  const [newText, setNewText] = useState('')
  const [preview, setPreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef()

  function handleImagePick(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePost() {
    if ((!newText.trim() && !imageFile) || posting) return
    setPosting(true)
    try {
      const image = imageFile ? await uploadImage(imageFile, 'posts') : null
      const text = newText.trim()
      await addPost({
        id: Date.now(),
        rider: currentRider,
        avatar: RIDER_AVATARS[currentRider] || '🤘',
        time: 'just now',
        text,
        image,
        likes: 0,
        tag: 'ride report',
        replies: [],
      })
      // Tagged riders get a personal notification; the rest of the crew a generic one
      const tagged = new Set(findMentions(text, roster.map(r => r.name)))
      tagged.delete(currentRider)
      const summary = text
        ? `${currentRider} posted: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`
        : `${currentRider} shared a photo in the feed`
      roster.forEach(r => {
        if (r.name === currentRider) return
        addNotification?.({
          id: Date.now() + Math.random(),
          rider: r.name,
          text: tagged.has(r.name)
            ? `🏷️ ${currentRider} tagged you in a post: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`
            : `📰 ${summary}`,
          time: 'just now',
          tab: 'feed',
        })
      })
      setNewText('')
      clearImage()
    } finally {
      setPosting(false)
    }
  }

  function handleLike(id) {
    const post = posts.find(p => p.id === id)
    if (post) updatePost(id, { likes: (post.likes || 0) + 1 })
  }

  function handleDelete(id) {
    removePost(id)
  }

  function handleEdit(id, text) {
    updatePost(id, { text })
  }

  function handleDeleteReply(postId, replyId) {
    const post = posts.find(p => p.id === postId)
    if (post) updatePost(postId, { replies: post.replies.filter(r => r.id !== replyId) })
  }

  function handleAddReply(postId, text) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const newReply = {
      id: Date.now(),
      rider: currentRider,
      avatar: RIDER_AVATARS[currentRider] || '🤘',
      text,
      time: 'just now',
    }

    updatePost(postId, { replies: [...post.replies, newReply] })

    // Tagged riders get a personal notification; author + previous repliers a generic one
    const tagged = new Set(findMentions(text, roster.map(r => r.name)))
    tagged.delete(currentRider)
    const toNotify = new Set(tagged)
    if (post.rider !== currentRider) toNotify.add(post.rider)
    post.replies.forEach(r => { if (r.rider !== currentRider) toNotify.add(r.rider) })

    toNotify.forEach(rider => {
      addNotification({
        id: Date.now() + Math.random(),
        rider,
        text: tagged.has(rider)
          ? `🏷️ ${currentRider} tagged you in a reply: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`
          : `${currentRider} replied to "${post.rider}'s post": "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
        time: 'just now',
        tab: 'feed',
      })
    })
  }

  return (
    <div style={{ padding: '16px 16px 8px' }}>
      {/* Compose box */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <Avatar rider={roster.find(r => r.name === currentRider)} emoji={RIDER_AVATARS[currentRider]} size={36} />
          <MentionInput
            textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            names={roster.map(r => r.name)}
            placeholder="What's rolling through your mind, brother? (@ to tag)"
            rows={3}
            containerStyle={{ flex: 1 }}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              outline: 'none', color: 'var(--text)', fontSize: 14, resize: 'none',
            }}
          />
        </div>

        {preview && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <img
              src={preview}
              alt="Preview"
              style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }}
            />
            <button
              onClick={clearImage}
              style={{
                position: 'absolute', top: 6, right: 6,
                background: 'rgba(0,0,0,0.7)', color: '#fff',
                borderRadius: '50%', width: 26, height: 26,
                fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImagePick}
          />
          <button
            onClick={() => fileRef.current.click()}
            style={{
              color: 'var(--text-muted)', fontSize: 22, lineHeight: 1,
              padding: '2px 6px', borderRadius: 6,
              background: preview ? '#1a2a1a' : 'transparent',
            }}
            title="Add photo"
          >📷</button>
          <button
            onClick={handlePost}
            style={{
              marginLeft: 'auto',
              background: 'var(--orange)', color: '#fff',
              fontWeight: 600, fontSize: 13,
              padding: '7px 18px', borderRadius: 8,
            }}
          >
            Post
          </button>
        </div>
      </div>

      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentRider={currentRider}
          isAdmin={isAdmin}
          onAddReply={handleAddReply}
          onLike={handleLike}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onDeleteReply={handleDeleteReply}
          roster={roster}
        />
      ))}
    </div>
  )
}
