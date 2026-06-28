import { useState, useRef } from 'react'
import { uploadImage } from '../lib/upload.js'

const CATEGORIES = ['All', 'Motorcycle', 'Helmet', 'Jacket', 'Exhaust', 'Seat', 'Fairing', 'Electronics', 'Luggage', 'Accessories', 'Parts', 'Tools', 'Other']
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']
const CONDITION_COLOR = { New: '#4caf50', 'Like New': '#81c784', Good: 'var(--gold)', Fair: 'var(--text-muted)' }

function timeLeft(endDate) {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const diff = end - now
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h left`
  return `${hours}h left`
}

const EMPTY_FORM = {
  title: '', description: '', category: 'Accessories', condition: 'Good',
  type: 'sale', price: '', startingBid: '', buyNowPrice: '', endDate: '', location: '',
}

export default function Marketplace({ listings = [], currentRider, isAdmin, onAddListing, onUpdateListing }) {
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('All')

  if (showForm) {
    return (
      <NewListingForm
        currentRider={currentRider}
        onSave={item => { onAddListing(item); setShowForm(false) }}
        onCancel={() => setShowForm(false)}
      />
    )
  }

  if (selected !== null) {
    const listing = listings.find(l => l.id === selected)
    if (!listing) { setSelected(null); return null }
    return (
      <ItemDetail
        listing={listing}
        currentRider={currentRider}
        isAdmin={isAdmin}
        onBack={() => setSelected(null)}
        onUpdate={patch => onUpdateListing(listing.id, patch)}
        onBuyNow={() => onUpdateListing(listing.id, { status: 'sold', soldTo: currentRider })}
      />
    )
  }

  const visible = listings.filter(l => {
    if (typeFilter === 'sale' && l.type !== 'sale') return false
    if (typeFilter === 'auction' && l.type !== 'auction') return false
    if (catFilter !== 'All' && l.category !== catFilter) return false
    return true
  })

  const active = visible.filter(l => l.status === 'active')
  const sold = visible.filter(l => l.status === 'sold')

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>🏪 MARKETPLACE</h2>
        <button
          onClick={() => setShowForm(true)}
          style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--orange)', borderRadius: 8, padding: '6px 14px' }}
        >+ Sell Item</button>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[['all', 'All'], ['sale', '🏷️ Buy Now'], ['auction', '🔨 Auctions']].map(([val, label]) => (
          <button key={val} onClick={() => setTypeFilter(val)}
            style={{
              flex: 1, fontSize: 11, fontWeight: 600, padding: '7px 0', borderRadius: 8,
              background: typeFilter === val ? 'var(--orange)' : 'var(--card)',
              color: typeFilter === val ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${typeFilter === val ? 'var(--orange)' : 'var(--border)'}`,
            }}>{label}</button>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
              background: catFilter === cat ? 'var(--gold)' : 'var(--card)',
              color: catFilter === cat ? '#111' : 'var(--text-muted)',
              border: `1px solid ${catFilter === cat ? 'var(--gold)' : 'var(--border)'}`,
              whiteSpace: 'nowrap',
            }}>{cat}</button>
        ))}
      </div>

      {active.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏪</div>
          <p style={{ fontSize: 13 }}>Nothing listed yet in this category.</p>
          <button onClick={() => setShowForm(true)} style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 8, padding: '8px 20px' }}>Be the first to sell</button>
        </div>
      )}

      {active.map(listing => <ListingCard key={listing.id} listing={listing} onSelect={() => setSelected(listing.id)} />)}

      {sold.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 10 }}>SOLD ({sold.length})</p>
          {sold.map(listing => <ListingCard key={listing.id} listing={listing} onSelect={() => setSelected(listing.id)} sold />)}
        </div>
      )}
    </div>
  )
}

function ListingCard({ listing, onSelect, sold }) {
  const isAuction = listing.type === 'auction'
  const tl = timeLeft(listing.endDate)

  return (
    <button onClick={onSelect} style={{
      width: '100%', textAlign: 'left', background: 'var(--card)',
      border: `1px solid ${sold ? 'var(--border)' : isAuction ? '#7986cb44' : 'var(--border)'}`,
      borderRadius: 12, marginBottom: 10, overflow: 'hidden',
      opacity: sold ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Image or placeholder */}
        <div style={{
          width: 100, flexShrink: 0, background: '#111',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          minHeight: 100,
        }}>
          {listing.images?.[0]
            ? <img src={listing.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : categoryIcon(listing.category)}
        </div>

        <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, flex: 1 }}>{listing.title}</p>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, flexShrink: 0,
              background: isAuction ? '#1a1a3a' : '#1a2a1a',
              color: isAuction ? '#9fa8da' : '#4caf50',
            }}>{isAuction ? '🔨 AUCTION' : '🏷️ SALE'}</span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            {listing.seller} · {listing.location}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {isAuction ? (
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)' }}>
                    ${(listing.currentBid || listing.startingBid).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                    {listing.bids.length > 0 ? `${listing.bids.length} bid${listing.bids.length > 1 ? 's' : ''}` : 'no bids'}
                  </span>
                  {listing.buyNowPrice && (
                    <div style={{ fontSize: 10, color: '#4caf50' }}>Buy Now ${listing.buyNowPrice.toLocaleString()}</div>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)' }}>${listing.price?.toLocaleString()}</span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: CONDITION_COLOR[listing.condition] }}>{listing.condition}</span>
              {tl && <div style={{ fontSize: 10, color: tl === 'Ended' ? '#e57373' : 'var(--gold)' }}>⏱ {tl}</div>}
              {sold && <div style={{ fontSize: 10, color: '#4caf50', fontWeight: 700 }}>✓ SOLD</div>}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

function ItemDetail({ listing, currentRider, isAdmin, onBack, onUpdate, onBuyNow }) {
  const [lightbox, setLightbox] = useState(null)
  const [bidAmount, setBidAmount] = useState('')
  const [bidError, setBidError] = useState('')
  const [confirm, setConfirm] = useState(null) // 'buyNow' | 'bid'
  const photoRef = useRef()
  const isMine = listing.seller === currentRider
  const isAuction = listing.type === 'auction'
  const tl = timeLeft(listing.endDate)
  const active = listing.status === 'active'
  const minBid = (listing.currentBid || listing.startingBid || 0) + 1

  async function handleAddPhoto(e) {
    const f = e.target.files[0]
    if (!f) return
    const url = await uploadImage(f, 'marketplace')
    onUpdate({ images: [...(listing.images || []), url] })
    if (photoRef.current) photoRef.current.value = ''
  }

  function handleBid() {
    const amount = parseFloat(bidAmount)
    if (!amount || amount < minBid) { setBidError(`Minimum bid is $${minBid}`); return }
    setBidError('')
    setConfirm('bid')
  }

  function confirmBid() {
    const amount = parseFloat(bidAmount)
    const newBid = { rider: currentRider, amount, time: 'just now' }
    onUpdate({
      currentBid: amount,
      currentBidder: currentRider,
      bids: [newBid, ...(listing.bids || [])],
    })
    setBidAmount('')
    setConfirm(null)
  }

  function confirmBuyNow() {
    onBuyNow()
    setConfirm(null)
  }

  function markSold() {
    onUpdate({ status: 'sold' })
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={{ color: 'var(--orange)', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        ‹ Back
      </button>

      {/* Photos */}
      <div style={{ marginBottom: 16 }}>
        {(listing.images || []).length > 0 ? (
          <div>
            <img src={listing.images[0]} alt="" onClick={() => setLightbox(listing.images[0])}
              style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, display: 'block', cursor: 'pointer', marginBottom: 6 }} />
            {listing.images.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {listing.images.slice(1).map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setLightbox(url)}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, cursor: 'pointer', display: 'block' }} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ height: 160, background: 'var(--card)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
            {categoryIcon(listing.category)}
          </div>
        )}
        {(isMine || isAdmin) && active && (
          <>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAddPhoto} />
            <button onClick={() => photoRef.current?.click()}
              style={{ marginTop: 8, width: '100%', fontSize: 12, fontWeight: 600, color: 'var(--gold)', border: '1px dashed var(--border)', borderRadius: 8, padding: '7px 0' }}>
              📷 Add Photo
            </button>
          </>
        )}
      </div>

      {/* Title + badges */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, flex: 1, lineHeight: 1.3 }}>{listing.title}</h2>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
          background: isAuction ? '#1a1a3a' : '#1a2a1a',
          color: isAuction ? '#9fa8da' : '#4caf50',
        }}>{isAuction ? '🔨 AUCTION' : '🏷️ SALE'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: CONDITION_COLOR[listing.condition], background: 'var(--card)', border: `1px solid ${CONDITION_COLOR[listing.condition]}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{listing.condition}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px' }}>{listing.category}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px' }}>📍 {listing.location}</span>
      </div>

      {/* Seller */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>SELLER</p>
          <p style={{ fontSize: 13, fontWeight: 600 }}>{listing.seller}</p>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Posted {listing.postedAt}</p>
      </div>

      {/* Description */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 1 }}>DESCRIPTION</p>
        <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.7 }}>{listing.description}</p>
      </div>

      {/* Sold badge */}
      {listing.status === 'sold' && (
        <div style={{ background: '#0a2a0a', border: '1px solid #4caf50', borderRadius: 10, padding: 14, marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#4caf50' }}>✓ SOLD</p>
          {listing.soldTo && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Sold to {listing.soldTo}</p>}
        </div>
      )}

      {/* Pricing / action block */}
      {active && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {isAuction ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>CURRENT BID</p>
                  <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--orange)' }}>${(listing.currentBid || listing.startingBid).toLocaleString()}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {listing.bids.length > 0 ? `${listing.bids.length} bid${listing.bids.length > 1 ? 's' : ''} · Leading: ${listing.currentBidder}` : 'No bids yet — be first!'}
                  </p>
                </div>
                {tl && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>ENDS</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: tl === 'Ended' ? '#e57373' : 'var(--gold)' }}>⏱ {tl}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{listing.endDate}</p>
                  </div>
                )}
              </div>

              {!isMine && tl !== 'Ended' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={e => { setBidAmount(e.target.value); setBidError('') }}
                      placeholder={`$${minBid} or more`}
                      style={{ flex: 1, background: '#111', border: `1px solid ${bidError ? '#e57373' : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' }}
                    />
                    <button onClick={handleBid}
                      style={{ background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '0 20px', borderRadius: 8, flexShrink: 0 }}>
                      Bid
                    </button>
                  </div>
                  {bidError && <p style={{ fontSize: 11, color: '#e57373', marginBottom: 8 }}>{bidError}</p>}

                  {listing.buyNowPrice && (
                    <button onClick={() => setConfirm('buyNow')}
                      style={{ width: '100%', background: '#4caf50', color: '#fff', fontWeight: 700, fontSize: 15, padding: '12px 0', borderRadius: 10 }}>
                      ⚡ Buy Now — ${listing.buyNowPrice.toLocaleString()}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PRICE</p>
              <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--orange)', marginBottom: 14 }}>${listing.price?.toLocaleString()}</p>
              {!isMine && (
                <button onClick={() => setConfirm('buyNow')}
                  style={{ width: '100%', background: '#4caf50', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px 0', borderRadius: 10 }}>
                  ⚡ Buy Now
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bid history */}
      {isAuction && listing.bids.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 10 }}>BID HISTORY</p>
          {listing.bids.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: i < listing.bids.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', background: '#2a1a0a', border: '1px solid var(--orange)', borderRadius: 6, padding: '1px 6px' }}>LEADING</span>}
                <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400 }}>{b.rider}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? 'var(--orange)' : 'var(--text-muted)' }}>${b.amount.toLocaleString()}</span>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Owner controls */}
      {(isMine || isAdmin) && active && (
        <button onClick={markSold}
          style={{ width: '100%', fontSize: 13, fontWeight: 600, color: '#4caf50', background: '#0a1a0a', border: '1px solid #4caf50', borderRadius: 10, padding: '11px 0', marginBottom: 16 }}>
          Mark as Sold
        </button>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div onClick={() => setConfirm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              {confirm === 'buyNow' ? '⚡ Confirm Purchase' : '🔨 Confirm Bid'}
            </p>
            <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, marginBottom: 16 }}>
              {confirm === 'buyNow'
                ? `Buy "${listing.title}" for $${(listing.buyNowPrice || listing.price)?.toLocaleString()}?`
                : `Place bid of $${parseFloat(bidAmount).toLocaleString()} on "${listing.title}"?`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={confirm === 'buyNow' ? confirmBuyNow : confirmBid}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: confirm === 'buyNow' ? '#4caf50' : 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                {confirm === 'buyNow' ? 'Buy Now' : 'Place Bid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

function NewListingForm({ currentRider, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const photoRef = useRef()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handlePhotos(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    const urls = await Promise.all(files.map(f => uploadImage(f, 'marketplace')))
    setImages(prev => [...prev, ...urls])
    setUploading(false)
    if (photoRef.current) photoRef.current.value = ''
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) return
    const price = form.type === 'sale' ? parseFloat(form.price) || null : null
    const startingBid = form.type === 'auction' ? parseFloat(form.startingBid) || null : null
    const buyNowPrice = form.buyNowPrice ? parseFloat(form.buyNowPrice) || null : null
    onSave({
      id: Date.now(),
      seller: currentRider,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      condition: form.condition,
      type: form.type,
      price,
      startingBid,
      currentBid: null,
      currentBidder: null,
      buyNowPrice,
      bids: [],
      images,
      location: form.location.trim(),
      postedAt: 'just now',
      endDate: form.endDate || null,
      status: 'active',
    })
  }

  const labelStyle = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, letterSpacing: 0.5 }
  const inputStyle = { width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>New Listing</h2>
        <button onClick={onCancel} style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cancel</button>
      </div>

      {/* Photos */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>PHOTOS</label>
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '1' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                <button onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotos} />
        <button onClick={() => photoRef.current?.click()} disabled={uploading}
          style={{ width: '100%', padding: '10px 0', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', background: 'var(--card)' }}>
          {uploading ? 'Uploading…' : '📷 Add Photos'}
        </button>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>TITLE *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What are you selling?" style={inputStyle} />
      </div>

      {/* Category + Condition */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>CATEGORY</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>CONDITION</label>
          <select value={form.condition} onChange={e => set('condition', e.target.value)} style={inputStyle}>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Type */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>LISTING TYPE</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['sale', '🏷️ For Sale'], ['auction', '🔨 Auction']].map(([val, label]) => (
            <button key={val} onClick={() => set('type', val)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: form.type === val ? 'var(--orange)' : '#111',
                color: form.type === val ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${form.type === val ? 'var(--orange)' : 'var(--border)'}`,
              }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Pricing */}
      {form.type === 'sale' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>PRICE ($) *</label>
          <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="e.g. 450" style={inputStyle} />
        </div>
      )}
      {form.type === 'auction' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>STARTING BID ($) *</label>
            <input type="number" value={form.startingBid} onChange={e => set('startingBid', e.target.value)} placeholder="e.g. 100" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>BUY NOW ($) optional</label>
            <input type="number" value={form.buyNowPrice} onChange={e => set('buyNowPrice', e.target.value)} placeholder="e.g. 350" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>AUCTION END DATE</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Location + Description */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>YOUR LOCATION</label>
        <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Phoenix, AZ" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>DESCRIPTION *</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
          placeholder="Describe the item — condition details, fit, why you're selling, what's included…"
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <button onClick={handleSubmit}
        disabled={!form.title.trim() || !form.description.trim()}
        style={{
          width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 15,
          padding: 14, borderRadius: 10, opacity: (!form.title.trim() || !form.description.trim()) ? 0.5 : 1,
        }}>
        Post Listing
      </button>
    </div>
  )
}

function categoryIcon(cat) {
  const icons = {
    Motorcycle: '🏍️', Helmet: '🪖', Jacket: '🧥', Exhaust: '💨', Seat: '🏍️',
    Fairing: '🛡️', Electronics: '🔊', Luggage: '🧳', Accessories: '⚙️',
    Parts: '🔧', Tools: '🛠️', Other: '📦',
  }
  return icons[cat] || '📦'
}
