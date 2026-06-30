import { useState, useRef } from 'react'
import { GEAR_CATEGORIES } from '../data/gear.js'
import { shareToWhatsApp } from '../utils/share.js'
import { uploadImage } from '../lib/upload.js'

const CAT_COLOR = {
  Gear:        { bg: '#1a2a1a', color: '#4caf50' },
  Accessories: { bg: '#1a1a2a', color: '#7986cb' },
  Performance: { bg: '#2a1010', color: '#ff7043' },
}

// Filter sections shown as pills
const SECTIONS = ['All', 'Gear', 'Accessories', 'Performance', 'Wishlist', 'Owned']

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.428a.75.75 0 0 0 .916.916l5.569-1.476A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 0 1-4.953-1.355l-.355-.211-3.676.974.974-3.564-.229-.368A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
    </svg>
  )
}

const EMPTY = { name: '', brand: '', category: 'Gear', status: 'wishlist', cost: '', website: '', taggedRider: '', notes: '' }

export default function Gear({ gear = [], addGear, updateGear, removeGear, currentRider, isAdmin, roster = [], addNotification }) {
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  function pickImage(e) {
    const f = e.target.files[0]
    if (!f) return
    setImageFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleAdd() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    const image = imageFile ? await uploadImage(imageFile, 'gear') : null
    const item = {
      id: Date.now(),
      name: form.name.trim(), brand: form.brand.trim(),
      category: form.category, status: form.status,
      cost: Number(form.cost) || 0, website: form.website.trim(),
      image, taggedRider: form.taggedRider || null,
      addedBy: currentRider, notes: form.notes.trim(),
    }
    await addGear(item)
    if (item.taggedRider && item.taggedRider !== currentRider) {
      addNotification?.({
        id: Date.now() + Math.random(),
        rider: item.taggedRider,
        text: `🛒 ${currentRider} tagged you to check out "${item.name}"${item.cost ? ` ($${item.cost})` : ''} in Gear.`,
        time: 'just now',
        tab: 'gear',
      })
    }
    setForm(EMPTY); setImageFile(null); setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    setShowForm(false); setSaving(false)
  }

  function toggleOwned(item) {
    updateGear(item.id, { status: item.status === 'owned' ? 'wishlist' : 'owned' })
  }

  function shareItem(item) {
    const lines = [
      `🏍️ Gear pick: ${item.name}`,
      item.brand && `Brand: ${item.brand}`,
      item.cost && `Price: $${item.cost.toLocaleString()}`,
      item.website && item.website,
      `— shared from Road Heaven`,
    ].filter(Boolean)
    shareToWhatsApp(lines.join('\n'))
  }

  const visible = gear.filter(g => {
    if (filter === 'All') return true
    if (filter === 'Wishlist') return g.status === 'wishlist'
    if (filter === 'Owned') return g.status === 'owned'
    return g.category === filter
  })
  const statusFiltered = filter === 'Wishlist' || filter === 'Owned'
  const wishlist = visible.filter(g => g.status === 'wishlist')
  const owned = visible.filter(g => g.status === 'owned')
  const total = wishlist.reduce((s, g) => s + (g.cost || 0), 0)

  const fieldStyle = { width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }
  const labelStyle = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>GEAR & MODS</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>${total.toLocaleString()} on the wishlist</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
          + Add
        </button>
      </div>

      {/* Section pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 20,
              background: filter === s ? 'var(--orange)' : 'var(--card)',
              color: filter === s ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${filter === s ? 'var(--orange)' : 'var(--border)'}`,
              fontWeight: filter === s ? 600 : 400,
            }}>{s}</button>
        ))}
      </div>

      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {[['Item name', 'name'], ['Brand', 'brand']].map(([label, key]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={labelStyle}>{label}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={fieldStyle} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={fieldStyle}>
                {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={fieldStyle}>
                <option value="wishlist">Wishlist</option>
                <option value="owned">Owned</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Cost ($)</label>
              <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tag a rider</label>
              <select value={form.taggedRider} onChange={e => setForm(f => ({ ...f, taggedRider: e.target.value }))} style={fieldStyle}>
                <option value="">— none —</option>
                {roster.map(r => <option key={r.id || r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Website / link</label>
            <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" style={fieldStyle} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={fieldStyle} />
          </div>

          {/* Image */}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
          {preview ? (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <img src={preview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} />
              <button onClick={() => { setImageFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '50%', width: 26, height: 26, fontSize: 14 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()}
              style={{ width: '100%', padding: '14px 0', background: '#111', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              📷 Add a photo
            </button>
          )}

          <button onClick={handleAdd} disabled={saving}
            style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 14, padding: 10, borderRadius: 8 }}>
            {saving ? 'Saving…' : 'Add Item'}
          </button>
        </div>
      )}

      {visible.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Nothing here yet.</p>
      )}

      {statusFiltered ? (
        visible.map(item => <GearCard key={item.id} item={item} currentRider={currentRider} isAdmin={isAdmin} onToggle={toggleOwned} onShare={shareItem} onRemove={removeGear} />)
      ) : (
        <>
          {wishlist.map(item => <GearCard key={item.id} item={item} currentRider={currentRider} isAdmin={isAdmin} onToggle={toggleOwned} onShare={shareItem} onRemove={removeGear} />)}
          {owned.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '20px 0 12px', letterSpacing: 1 }}>OWNED</h3>
              {owned.map(item => <GearCard key={item.id} item={item} currentRider={currentRider} isAdmin={isAdmin} onToggle={toggleOwned} onShare={shareItem} onRemove={removeGear} />)}
            </>
          )}
        </>
      )}
    </div>
  )
}

function GearCard({ item, currentRider, isAdmin, onToggle, onShare, onRemove }) {
  const cat = CAT_COLOR[item.category] || CAT_COLOR.Gear
  const owned = item.status === 'owned'
  const canRemove = isAdmin || item.addedBy === currentRider
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, marginBottom: 10, overflow: 'hidden', opacity: owned ? 0.7 : 1,
    }}>
      {item.image && (
        <img src={item.image} alt={item.name} loading="lazy" decoding="async" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, textDecoration: owned ? 'line-through' : 'none' }}>{item.name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, ...cat }}>{item.category}</span>
            </div>
            {item.brand && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{item.brand}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {item.cost > 0 && (
                <span style={{ fontSize: 16, fontWeight: 700, color: owned ? 'var(--text-muted)' : 'var(--orange)' }}>${item.cost.toLocaleString()}</span>
              )}
              {item.website && (
                <a href={item.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>🔗 Link</a>
              )}
            </div>
            {item.notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{item.notes}</p>}
            {item.taggedRider && (
              <div style={{ fontSize: 11, color: '#7986cb', marginTop: 6 }}>👤 Tagged {item.taggedRider} to check it out</div>
            )}
          </div>
          <button onClick={() => onToggle(item)} title={owned ? 'Owned' : 'Mark owned'}
            style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${owned ? '#4caf50' : 'var(--border)'}`,
              background: owned ? '#4caf50' : 'transparent', color: owned ? '#fff' : 'var(--text-muted)',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{owned ? '✓' : ''}</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
          <button onClick={() => onShare(item)}
            style={{ color: '#25D366', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <WhatsAppIcon /> Share
          </button>
          {item.addedBy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>added by {item.addedBy}</span>}
          {canRemove && (
            <button onClick={() => onRemove(item.id)} style={{ marginLeft: 'auto', color: '#e57373', fontSize: 12 }}>🗑️ Remove</button>
          )}
        </div>
      </div>
    </div>
  )
}
