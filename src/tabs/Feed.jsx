import { useState, useRef } from 'react'
import { shareWithImage } from '../utils/share.js'
import { RIDER_AVATARS } from '../data/posts.js'
import { uploadImage } from '../lib/upload.js'

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.428a.75.75 0 0 0 .916.916l5.569-1.476A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 0 1-4.953-1.355l-.355-.211-3.676.974.974-3.564-.229-.368A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
    </svg>
  )
}

const TAG_COLORS = {
  'ride report': { bg: '#1a2a1a', color: '#4caf50' },
  'build':       { bg: '#1a1a2a', color: '#7986cb' },
  'event':       { bg: '#2a1a0a', color: 'var(--gold)' },
}

function PostCard({ post, currentRider, isAdmin, onAddReply, onLike, onDelete, onEdit, onDeleteReply }) {
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
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#2a2a2a', border: '2px solid var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>{post.avatar}</div>
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
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#ddd', marginBottom: post.image ? 10 : 0 }}>{post.text}</p>
          )
        )}

        {post.image && (
          <img
            src={post.image}
            alt="Post"
            onClick={() => setLightbox(true)}
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
        <button
          onClick={() => shareWithImage({
            text: `${post.rider} on Road Heaven:\n\n"${post.text}"`,
            imageFile: post.imageFile,
          })}
          style={{ marginLeft: 'auto', color: '#25D366', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
        >
          <WhatsAppIcon /> Share
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
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#2a2a2a', border: '1.5px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{r.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.rider}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.time}</span>
                </div>
                <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>{r.text}</p>
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
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#2a2a2a', border: '1.5px solid var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>{RIDER_AVATARS[currentRider] || '🤘'}</div>
            <input
              ref={inputRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Reply as ${currentRider.split(' ')[0]}…`}
              style={{
                flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
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

export default function Feed({ currentRider, isAdmin, addNotification, posts, addPost, updatePost, removePost }) {
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
    const image = imageFile ? await uploadImage(imageFile, 'posts') : null
    await addPost({
      id: Date.now(),
      rider: currentRider,
      avatar: RIDER_AVATARS[currentRider] || '🤘',
      time: 'just now',
      text: newText.trim(),
      image,
      likes: 0,
      tag: 'ride report',
      replies: [],
    })
    setNewText('')
    clearImage()
    setPosting(false)
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

    // Notify the post author and previous repliers (excluding currentRider)
    const toNotify = new Set()
    if (post.rider !== currentRider) toNotify.add(post.rider)
    post.replies.forEach(r => { if (r.rider !== currentRider) toNotify.add(r.rider) })

    toNotify.forEach(rider => {
      addNotification({
        id: Date.now() + Math.random(),
        rider,
        text: `${currentRider} replied to "${post.rider}'s post": "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
        time: 'just now',
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
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#2a2a2a', border: '2px solid var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>{RIDER_AVATARS[currentRider] || '🤘'}</div>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="What's rolling through your mind, brother?"
            rows={3}
            style={{
              flex: 1, background: 'transparent', border: 'none',
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
        />
      ))}
    </div>
  )
}
