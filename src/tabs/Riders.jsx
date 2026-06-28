import { useState, useRef } from 'react'
import { uploadImage } from '../lib/upload.js'

const CURRENT_YEAR = new Date().getFullYear()

export const INITIAL_RIDERS = [
  {
    id: 1, name: 'Big Mike', handle: '@bigmike_hd', avatar: '🧔', photo: null, album: [], garage: [
      { id: 101, year: '2021', make: 'Harley-Davidson', model: 'Fat Boy 114', mileage: '68,880', color: 'Vivid Black', notes: 'Stage II tune, Vance & Hines exhaust', status: 'owned', accessories: [{ id: 1011, text: 'Vance & Hines exhaust' }, { id: 1012, text: 'Stage II tuner' }, { id: 1013, text: 'Mustang seat' }], photos: [] },
    ],
    bike: '2021 Harley-Davidson Fat Boy 114', miles: 68880,
    joined: 'Chapter founder · 2018', role: 'Road Captain',
    tags: ['canyon runs', 'long distance', 'wrenching'],
    bio: 'Born to ride, forced to work. Fat Boy or nothing.',
    location: 'Phoenix, AZ', ridingSince: 1998, favoriteRoad: 'Apache Trail (AZ-88)',
    bloodType: 'O+', emergency: { name: 'Carol (wife)', phone: '602-555-0142' },
    gear: { helmet: 'Bell Bullitt', jacket: 'Vanson Cafe Racer' },
  },
  {
    id: 2, name: 'Steel Lisa', handle: '@steel_lisa', avatar: '👩‍🦱', photo: null, album: [], garage: [
      { id: 201, year: '2022', make: 'Harley-Davidson', model: 'Softail Standard', mileage: '45,705', color: 'Gunship Gray', notes: 'Chrome sissy bar, custom mirrors', status: 'owned', accessories: [{ id: 2011, text: 'Chrome sissy bar' }, { id: 2012, text: 'Custom bar-end mirrors' }], photos: [] },
    ],
    bike: '2022 Softail Standard', miles: 45705,
    joined: 'Member since 2020', role: 'Member',
    tags: ['custom builds', 'chrome', 'Sturgis veteran'],
    bio: 'More chrome than your house.',
    location: 'Tucson, AZ', ridingSince: 2011, favoriteRoad: 'Mt Lemmon Highway',
    bloodType: 'A-', emergency: { name: 'Marcus (brother)', phone: '520-555-0188' },
    gear: { helmet: 'Shoei RF-1400', jacket: 'Dainese Leather' },
  },
  {
    id: 3, name: 'Diesel Dave', handle: '@diesel_d', avatar: '🧑‍🦲', photo: null, album: [], garage: [
      { id: 301, year: '2019', make: 'Harley-Davidson', model: 'Road Glide Special', mileage: '114,585', color: 'Twisted Cherry', notes: 'Full touring setup, Rockford Fosgate audio', status: 'owned', accessories: [{ id: 3011, text: 'Rockford Fosgate audio' }, { id: 3012, text: 'Tour-Pak luggage' }], photos: [] },
    ],
    bike: '2019 Road Glide Special', miles: 114585,
    joined: 'Member since 2018', role: 'Treasurer',
    tags: ['touring', 'charity runs', 'mechanics'],
    bio: 'The miles are the point. Everything else is just noise.',
    location: 'Mesa, AZ', ridingSince: 2003, favoriteRoad: 'Beartooth Pass (US-212)',
    bloodType: 'B+', emergency: { name: 'Diane (wife)', phone: '480-555-0119' },
    gear: { helmet: 'Schuberth C5', jacket: 'Klim Induction' },
  },
  {
    id: 4, name: 'RedRock Ray', handle: '@redrock_ray', avatar: '👨‍🦳', photo: null, album: [], garage: [
      { id: 401, year: '2020', make: 'Harley-Davidson', model: 'Street Glide', mileage: '89,479', color: 'Billet Silver', notes: 'Saddlemen seat, Memphis Shades fairing', status: 'owned', accessories: [{ id: 4011, text: 'Memphis Shades fairing' }, { id: 4012, text: 'Saddlemen seat' }], photos: [] },
    ],
    bike: '2020 Street Glide', miles: 89479,
    joined: 'Member since 2019', role: 'Member',
    tags: ['Southwest routes', 'Route 66', 'photography'],
    bio: "Chasing sunsets on two wheels since '89.",
    location: 'Sedona, AZ', ridingSince: 1989, favoriteRoad: 'Route 66 — Oatman stretch',
    bloodType: 'O-', emergency: { name: 'Janet (sister)', phone: '928-555-0173' },
    gear: { helmet: 'Arai XD-4', jacket: 'Rev\'It Sand 4' },
  },
  {
    id: 5, name: 'Snake Pete', handle: '@snakepete', avatar: '🧑‍🦱', photo: null, album: [], garage: [
      { id: 501, year: '2023', make: 'Harley-Davidson', model: 'Low Rider ST', mileage: '23,014', color: 'Vivid Black', notes: 'Stock for now, saving up for pipes', status: 'owned', accessories: [], photos: [] },
    ],
    bike: '2023 Low Rider ST', miles: 23014,
    joined: 'Member since 2023', role: 'Prospect',
    tags: ['newer rider', 'canyon carver', 'gearhead'],
    bio: 'New to the chapter, not new to the road.',
    location: 'Scottsdale, AZ', ridingSince: 2019, favoriteRoad: 'Nine Mile Hill',
    bloodType: 'AB+', emergency: { name: 'Tony (roommate)', phone: '480-555-0204' },
    gear: { helmet: 'HJC RPHA 11', jacket: 'Alpinestars T-Faster' },
  },
  {
    id: 6, name: 'Iron Nate', handle: '@iron_nate', avatar: '👨‍🦱', photo: null, album: [], garage: [
      { id: 601, year: '2018', make: 'Harley-Davidson', model: 'Iron 1200', mileage: '54,557', color: 'Black Denim', notes: 'Bobber kit, ape hangers, blacked out', status: 'owned', accessories: [{ id: 6011, text: 'Ape hanger bars' }, { id: 6012, text: 'Bobber fender kit' }], photos: [] },
    ],
    bike: '2018 Iron 1200', miles: 54557,
    joined: 'Member since 2021', role: 'Member',
    tags: ['bobbers', 'night rides', 'fabrication'],
    bio: 'If it ain\'t blacked out, it ain\'t mine.',
    location: 'Tempe, AZ', ridingSince: 2009, favoriteRoad: 'Bush Highway after dark',
    bloodType: 'A+', emergency: { name: 'Rosa (mom)', phone: '480-555-0157' },
    gear: { helmet: 'Biltwell Gringo', jacket: 'Roland Sands Ronin' },
  },
]

// Seed each demo rider's helmet collection from their primary helmet
INITIAL_RIDERS.forEach(r => {
  if (!r.helmets) r.helmets = r.gear?.helmet ? [{ id: r.id * 1000 + 1, name: r.gear.helmet, photo: null }] : []
})

const ROLES = { 'Road Captain': 'var(--orange)', 'Treasurer': 'var(--gold)', 'Member': '#4a4a4a', 'Prospect': '#2a2a2a' }
const ROLE_TEXT = { 'Road Captain': '#fff', 'Treasurer': '#111', 'Member': 'var(--text-muted)', 'Prospect': 'var(--text-muted)' }
const ROLE_OPTIONS = ['Road Captain', 'Treasurer', 'Member', 'Prospect']

// Compute earned achievement badges from rider + trip data
function getAchievements(rider, trips) {
  const badges = []
  const parts = name => trips.filter(t => (t.participations || []).some(p => p.riderName === name))
  const myTrips = parts(rider.name)

  if (/founder/i.test(rider.joined)) badges.push({ icon: '🏆', label: 'Chapter Founder', color: 'var(--orange)' })
  if (rider.role === 'Road Captain') badges.push({ icon: '🧭', label: 'Road Captain', color: 'var(--orange)' })
  if (rider.role === 'Treasurer') badges.push({ icon: '💰', label: 'Treasurer', color: 'var(--gold)' })

  if (rider.miles >= 100000) badges.push({ icon: '🔥', label: '100K KM Club', color: 'var(--gold)' })
  else if (rider.miles >= 50000) badges.push({ icon: '⭐', label: '50K KM Club', color: 'var(--gold)' })
  else if (rider.miles >= 20000) badges.push({ icon: '✨', label: '20K KM Club', color: '#7986cb' })

  if (myTrips.some(t => /sturgis/i.test(t.name)) || rider.tags.some(t => /sturgis/i.test(t)))
    badges.push({ icon: '🦅', label: 'Sturgis Veteran', color: '#7986cb' })
  if (myTrips.some(t => /charity|poker/i.test(t.name)))
    badges.push({ icon: '🖤', label: 'Charity Rider', color: '#4caf50' })
  if (rider.garage.length > 1) badges.push({ icon: '🏍️', label: 'Multi-Bike Owner', color: '#7986cb' })
  if ((CURRENT_YEAR - rider.ridingSince) >= 20) badges.push({ icon: '🛣️', label: 'Veteran Rider', color: 'var(--orange)' })

  return badges
}

// Find the riders this person shares the most trips with
function getCrewBonds(rider, trips, allRiders) {
  const myTrips = trips.filter(t => (t.participations || []).some(p => p.riderName === rider.name))
  const counts = {}
  myTrips.forEach(t => {
    (t.participations || []).forEach(p => {
      if (p.riderName !== rider.name) counts[p.riderName] = (counts[p.riderName] || 0) + 1
    })
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count, rider: allRiders.find(r => r.name === name) }))
}

export default function Riders({ riders = [], onUpdateRider, trips = [], updateTrip, posts = [], challenges = [], currentRider, isAdmin, onNavigateToFeed, onNavigateToChallenges }) {
  const [selected, setSelected] = useState(null)

  if (selected) {
    const rider = riders.find(r => r.id === selected)
    if (!rider) { setSelected(null); return null }
    const canEdit = isAdmin || rider.name === currentRider
    return (
      <RiderDetail
        rider={rider}
        riders={riders}
        trips={trips}
        updateTrip={updateTrip}
        posts={posts}
        challenges={challenges}
        canEdit={canEdit}
        onBack={() => setSelected(null)}
        onUpdate={patch => onUpdateRider(selected, patch)}
        onNavigateToFeed={onNavigateToFeed}
        onNavigateToChallenges={onNavigateToChallenges}
      />
    )
  }

  const leaderboard = [...riders].sort((a, b) => (b.miles || 0) - (a.miles || 0))
  const topMiles = leaderboard[0]?.miles || 1

  return (
    <div style={{ padding: 16 }}>
      {/* Mileage leaderboard */}
      {riders.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>🏁 DISTANCE LEADERBOARD</h2>
          {leaderboard.map((r, i) => {
            const medal = ['🥇', '🥈', '🥉'][i]
            return (
              <button key={r.id} onClick={() => setSelected(r.id)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card)', border: `1px solid ${i === 0 ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                }}>
                <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0, color: 'var(--text-muted)', fontWeight: 700 }}>
                  {medal || i + 1}
                </span>
                <Avatar rider={r} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}{r.name === currentRider && <span style={{ fontSize: 9, color: 'var(--orange)', marginLeft: 6, fontWeight: 700 }}>YOU</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)', flexShrink: 0, marginLeft: 8 }}>{(r.miles || 0).toLocaleString()} km</span>
                  </div>
                  <div style={{ height: 5, background: '#111', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(4, ((r.miles || 0) / topMiles) * 100)}%`, background: i === 0 ? 'var(--gold)' : 'var(--orange)', borderRadius: 3 }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 16 }}>CREW ROSTER ({riders.length})</h2>
      {riders.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          No approved riders yet.
        </p>
      )}
      {riders.map(rider => (
        <button
          key={rider.id}
          onClick={() => setSelected(rider.id)}
          style={{
            width: '100%', textAlign: 'left',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 14, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <Avatar rider={rider} size={50} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{rider.name}</span>
              {rider.name === currentRider && (
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 5, padding: '1px 5px' }}>YOU</span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: ROLES[rider.role], color: ROLE_TEXT[rider.role],
              }}>{rider.role}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>{rider.bike}</div>
            <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 3 }}>{rider.miles.toLocaleString()} km · 📍 {rider.location}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🗓️ {rider.joined}</div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
        </button>
      ))}

    </div>
  )
}

function Avatar({ rider, size }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#2a2a2a', border: `${size > 60 ? 3 : 2}px solid var(--orange)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.48, flexShrink: 0, overflow: 'hidden',
    }}>
      {rider.photo
        ? <img src={rider.photo} alt={rider.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : rider.avatar}
    </div>
  )
}

const EMPTY_BIKE = { year: '', make: '', model: '', mileage: '', color: '', notes: '', status: 'owned' }

const SECTIONS = [
  ['feed', '📰', 'Feed'],
  ['garage', '🔧', 'Garage'],
  ['helmets', '🪖', 'Helmets'],
  ['rides', '🏍️', 'Rides'],
  ['photos', '📸', 'Photos'],
  ['about', 'ℹ️', 'About'],
]

function RiderDetail({ rider, riders, trips, updateTrip, posts, challenges = [], canEdit, onBack, onUpdate, onNavigateToFeed, onNavigateToChallenges }) {
  const photoRef = useRef()
  const albumRef = useRef()
  const bikePhotoRefs = useRef({})
  const [lightbox, setLightbox] = useState(null)
  const [section, setSection] = useState('feed')
  const [showGarageForm, setShowGarageForm] = useState(false)
  const [bikeForm, setBikeForm] = useState(EMPTY_BIKE)
  const [expandedBike, setExpandedBike] = useState(null)
  const [accDraft, setAccDraft] = useState({})
  const [editingAcc, setEditingAcc] = useState(null) // { bikeId, accId, text }
  const [helmetName, setHelmetName] = useState('')
  const [helmetFile, setHelmetFile] = useState(null)
  const [helmetPreview, setHelmetPreview] = useState(null)
  const [savingHelmet, setSavingHelmet] = useState(false)
  const helmetRef = useRef()
  const helmetPhotoRef = useRef()
  const [uploadingHelmId, setUploadingHelmId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState(null)

  const riderTrips = trips.filter(t => (t.participations || []).some(p => p.riderName === rider.name))
  const completedTrips = riderTrips.filter(t => t.status === 'completed')
  const upcomingTrips = riderTrips.filter(t => t.status === 'upcoming')
  const approvedCount = trips.filter(t =>
    t.status === 'completed' &&
    (t.participations || []).some(p => p.riderName === rider.name && p.status === 'approved')
  ).length

  const yearsRiding = CURRENT_YEAR - rider.ridingSince
  const achievements = getAchievements(rider, trips)
  const crewBonds = getCrewBonds(rider, trips, riders)
  const myPosts = posts.filter(p => p.rider === rider.name)
  const trophies = challenges.filter(c => (c.participants || []).some(p => p.riderName === rider.name && p.status === 'awarded'))

  function startEdit() {
    setEdit({
      bio: rider.bio, handle: rider.handle, role: rider.role,
      miles: String(rider.miles), tags: rider.tags.join(', '),
      location: rider.location, ridingSince: String(rider.ridingSince),
      favoriteRoad: rider.favoriteRoad, bloodType: rider.bloodType,
      emergencyName: rider.emergency.name, emergencyPhone: rider.emergency.phone,
      helmet: rider.gear.helmet, jacket: rider.gear.jacket,
    })
    setEditing(true)
    setSection('about')
  }

  function saveEdit() {
    onUpdate({
      bio: edit.bio, handle: edit.handle, role: edit.role,
      miles: parseInt(edit.miles.replace(/[^0-9]/g, ''), 10) || 0,
      tags: edit.tags.split(',').map(t => t.trim()).filter(Boolean),
      location: edit.location, ridingSince: parseInt(edit.ridingSince, 10) || rider.ridingSince,
      favoriteRoad: edit.favoriteRoad, bloodType: edit.bloodType,
      emergency: { name: edit.emergencyName, phone: edit.emergencyPhone },
      gear: { helmet: edit.helmet, jacket: edit.jacket },
    })
    setEditing(false)
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    onUpdate({ photo: await uploadImage(file, 'avatars') })
  }

  function handleAddBike() {
    if (!bikeForm.make || !bikeForm.model) return
    const newBike = { id: Date.now(), ...bikeForm, accessories: [], photos: [] }
    onUpdate({ garage: [...rider.garage, newBike] })
    setBikeForm(EMPTY_BIKE)
    setShowGarageForm(false)
    setExpandedBike(newBike.id)
  }

  function handleRemoveBike(id) {
    onUpdate({ garage: rider.garage.filter(b => b.id !== id) })
    if (expandedBike === id) setExpandedBike(null)
  }

  function toggleBikeStatus(id) {
    onUpdate({ garage: rider.garage.map(b => b.id === id ? { ...b, status: b.status === 'sold' ? 'owned' : 'sold' } : b) })
  }

  function addAccessory(bikeId) {
    const text = (accDraft[bikeId] || '').trim()
    if (!text) return
    onUpdate({ garage: rider.garage.map(b => b.id === bikeId
      ? { ...b, accessories: [...(b.accessories || []), { id: Date.now() + Math.random(), text }] } : b) })
    setAccDraft(d => ({ ...d, [bikeId]: '' }))
  }

  function removeAccessory(bikeId, accId) {
    onUpdate({ garage: rider.garage.map(b => b.id === bikeId
      ? { ...b, accessories: (b.accessories || []).filter(a => a.id !== accId) } : b) })
  }

  function updateAccessory(bikeId, accId, text) {
    if (!text.trim()) return
    onUpdate({ garage: rider.garage.map(b => b.id === bikeId
      ? { ...b, accessories: (b.accessories || []).map(a => a.id === accId ? { ...a, text: text.trim() } : a) } : b) })
    setEditingAcc(null)
  }

  function pickHelmetPhoto(e) {
    const f = e.target.files[0]
    if (!f) return
    setHelmetFile(f)
    setHelmetPreview(URL.createObjectURL(f))
  }

  async function addHelmet() {
    if (!helmetName.trim() || savingHelmet) return
    setSavingHelmet(true)
    const photo = helmetFile ? await uploadImage(helmetFile, 'helmets') : null
    onUpdate({ helmets: [...(rider.helmets || []), { id: Date.now() + Math.random(), name: helmetName.trim(), photo }] })
    setHelmetName(''); setHelmetFile(null); setHelmetPreview(null)
    if (helmetRef.current) helmetRef.current.value = ''
    setSavingHelmet(false)
  }

  function removeHelmet(id) {
    onUpdate({ helmets: (rider.helmets || []).filter(h => h.id !== id) })
  }

  function handleWithdraw(tripId) {
    const trip = trips.find(t => t.id === tripId)
    if (!trip) return
    updateTrip(tripId, { participations: (trip.participations || []).filter(p => p.riderName !== rider.name) })
  }

  async function addHelmetPhoto(e) {
    const f = e.target.files[0]
    if (!f || !uploadingHelmId) return
    const photo = await uploadImage(f, 'helmets')
    onUpdate({ helmets: (rider.helmets || []).map(h => h.id === uploadingHelmId ? { ...h, photo } : h) })
    setUploadingHelmId(null)
    if (helmetPhotoRef.current) helmetPhotoRef.current.value = ''
  }

  async function handleBikePhoto(e, bikeId) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const ref = bikePhotoRefs.current[bikeId]
    const urls = await Promise.all(files.map(async f => ({ id: Date.now() + Math.random(), url: await uploadImage(f, 'bikes') })))
    onUpdate({ garage: rider.garage.map(b => b.id === bikeId ? { ...b, photos: [...b.photos, ...urls] } : b) })
    if (ref) ref.value = ''
  }

  function handleRemoveBikePhoto(bikeId, photoId) {
    onUpdate({ garage: rider.garage.map(b => b.id === bikeId ? { ...b, photos: b.photos.filter(p => p.id !== photoId) } : b) })
  }

  async function handleAlbumAdd(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const urls = await Promise.all(files.map(async f => ({ id: Date.now() + Math.random(), url: await uploadImage(f, 'albums'), name: f.name })))
    onUpdate({ album: [...rider.album, ...urls] })
    if (albumRef.current) albumRef.current.value = ''
  }

  function removeAlbumPhoto(id) {
    onUpdate({ album: rider.album.filter(p => p.id !== id) })
  }

  const ownedCount = rider.garage.filter(b => (b.status || 'owned') !== 'sold').length

  return (
    <div style={{ padding: 16 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={onBack} style={{ color: 'var(--orange)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          ‹ Back
        </button>
        {canEdit && !editing && (
          <button onClick={startEdit} style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px' }}>
            ✏️ Edit Profile
          </button>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--orange)', borderRadius: 8, padding: '5px 14px' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '5px 10px' }}>Cancel</button>
          </div>
        )}
      </div>

      {/* Header: avatar / name / role / bio */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div onClick={() => rider.photo && setLightbox(rider.photo)} style={{ cursor: rider.photo ? 'pointer' : 'default' }}>
            <Avatar rider={rider} size={90} />
          </div>
          {canEdit && (
            <button onClick={() => photoRef.current.click()}
              style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--orange)', borderRadius: '50%', width: 28, height: 28, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}
              title="Change photo">📷</button>
          )}
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{rider.name}</h2>
        {editing ? (
          <input value={edit.handle} onChange={e => setEdit(s => ({ ...s, handle: e.target.value }))} style={inputStyle({ width: 160, textAlign: 'center', marginBottom: 8 })} />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{rider.handle}</span>
        )}
        {editing ? (
          <select value={edit.role} onChange={e => setEdit(s => ({ ...s, role: e.target.value }))} style={inputStyle({ width: 160 })}>
            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: ROLES[rider.role], color: ROLE_TEXT[rider.role] }}>{rider.role}</span>
        )}
      </div>

      {editing ? (
        <textarea value={edit.bio} onChange={e => setEdit(s => ({ ...s, bio: e.target.value }))} rows={2}
          style={inputStyle({ width: '100%', marginBottom: 18, resize: 'none', textAlign: 'center' })} />
      ) : (
        <p style={{ fontSize: 14, color: '#ccc', textAlign: 'center', lineHeight: 1.6, marginBottom: 18, fontStyle: 'italic' }}>"{rider.bio}"</p>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <StatBox label="Km Ridden" value={editing
          ? <input value={edit.miles} onChange={e => setEdit(s => ({ ...s, miles: e.target.value }))} style={inputStyle({ width: '100%', textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--orange)' })} />
          : rider.miles.toLocaleString()} />
        <StatBox label="Rides Completed" value={approvedCount} />
        <StatBox label="Years Riding" value={editing
          ? <input value={edit.ridingSince} onChange={e => setEdit(s => ({ ...s, ridingSince: e.target.value }))} style={inputStyle({ width: '100%', textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--orange)' })} />
          : yearsRiding} />
        <StatBox label="Bikes Owned" value={ownedCount} />
      </div>

      {/* Section tab bar — all sections fit on screen, no horizontal scroll */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        {SECTIONS.map(([id, icon, label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{
              flex: 1, minWidth: 0, padding: '8px 2px 6px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: section === id ? 'var(--orange)' : 'var(--text-muted)',
              borderBottom: `2px solid ${section === id ? 'var(--orange)' : 'transparent'}`,
            }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ============ FEED ============ */}
      {section === 'feed' && (
        <div>
          <ActivityFeed
            rider={rider} myPosts={myPosts} trophies={trophies}
            completedTrips={completedTrips} upcomingTrips={upcomingTrips}
            onNavigateToFeed={onNavigateToFeed} onNavigateToChallenges={onNavigateToChallenges}
          />
        </div>
      )}

      {/* ============ GARAGE ============ */}
      {section === 'garage' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
              🔧 THE GARAGE {rider.garage.length > 0 && `(${rider.garage.length})`}
            </p>
            {canEdit && (
              <button onClick={() => setShowGarageForm(v => !v)}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 6, padding: '4px 10px' }}>
                + Add Bike
              </button>
            )}
          </div>

          {showGarageForm && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {[['Year', 'year'], ['Color', 'color']].map(([label, key]) => (
                  <div key={key} style={{ flex: 1 }}>
                    <label style={fLabel}>{label}</label>
                    <input value={bikeForm[key]} onChange={e => setBikeForm(f => ({ ...f, [key]: e.target.value }))} style={fInput} />
                  </div>
                ))}
              </div>
              {[['Make', 'make'], ['Model', 'model'], ['Mileage', 'mileage']].map(([label, key]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={fLabel}>{label}</label>
                  <input value={bikeForm[key]} onChange={e => setBikeForm(f => ({ ...f, [key]: e.target.value }))} style={fInput} />
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <label style={fLabel}>Ownership</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['owned', 'sold'].map(s => (
                    <button key={s} onClick={() => setBikeForm(f => ({ ...f, status: s }))}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                        background: bikeForm.status === s ? 'var(--orange)' : '#111',
                        color: bikeForm.status === s ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${bikeForm.status === s ? 'var(--orange)' : 'var(--border)'}`,
                      }}>{s === 'owned' ? '✅ Still own it' : '💸 Sold it'}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={fLabel}>Notes</label>
                <textarea value={bikeForm.notes} onChange={e => setBikeForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...fInput, resize: 'none' }} />
              </div>
              <button onClick={handleAddBike} style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 14, padding: 10, borderRadius: 8 }}>
                Add to Garage
              </button>
            </div>
          )}

          {rider.garage.length === 0 && !showGarageForm && (
            <button onClick={() => canEdit && setShowGarageForm(true)}
              style={{ width: '100%', padding: '24px 0', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🏍️</span>
              {canEdit ? 'Add your first bike' : 'No bikes listed'}
            </button>
          )}

          {rider.garage.map(bike => {
            const isOpen = expandedBike === bike.id
            const sold = (bike.status || 'owned') === 'sold'
            const accessories = bike.accessories || []
            if (!bikePhotoRefs.current[bike.id]) bikePhotoRefs.current[bike.id] = null
            return (
              <div key={bike.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', opacity: sold ? 0.85 : 1 }}>
                <div style={{ position: 'relative' }}>
                  {bike.photos.length > 0 ? (
                    <img src={bike.photos[0].url} alt={bike.model} onClick={() => setLightbox(bike.photos[0].url)}
                      style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', cursor: 'pointer', filter: sold ? 'grayscale(0.5)' : 'none' }} />
                  ) : (
                    <div style={{ height: 100, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🏍️</div>
                  )}
                  <span style={{
                    position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: sold ? 'rgba(0,0,0,0.7)' : 'rgba(76,175,80,0.85)', color: '#fff', letterSpacing: 0.5,
                  }}>{sold ? '💸 SOLD' : '✅ OWNED'}</span>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{bike.year} {bike.make}</p>
                      <p style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600 }}>{bike.model}</p>
                    </div>
                    <button onClick={() => setExpandedBike(isOpen ? null : bike.id)}
                      style={{ color: 'var(--text-muted)', fontSize: 18, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</button>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    {bike.mileage && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {bike.mileage} km</span>}
                    {bike.color && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎨 {bike.color}</span>}
                    {accessories.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🛠️ {accessories.length} mods</span>}
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 12 }}>
                      {bike.notes && (
                        <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6, marginBottom: 12, background: '#111', borderRadius: 8, padding: '8px 12px' }}>🔧 {bike.notes}</p>
                      )}

                      {/* Accessories list */}
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>🛠️ ACCESSORIES & MODS</p>
                      {accessories.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>None added yet.</p>}
                      {accessories.map(a => (
                        editingAcc?.bikeId === bike.id && editingAcc?.accId === a.id ? (
                          <div key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            <input
                              value={editingAcc.text}
                              onChange={e => setEditingAcc(s => ({ ...s, text: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') updateAccessory(bike.id, a.id, editingAcc.text)
                                if (e.key === 'Escape') setEditingAcc(null)
                              }}
                              autoFocus
                              style={{ flex: 1, background: '#111', border: '1px solid var(--orange)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                            />
                            <button onClick={() => updateAccessory(bike.id, a.id, editingAcc.text)} style={{ background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '0 12px', borderRadius: 8 }}>Save</button>
                            <button onClick={() => setEditingAcc(null)} style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 4px' }}>✕</button>
                          </div>
                        ) : (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', borderRadius: 8, padding: '7px 10px', marginBottom: 6 }}>
                            <span style={{ color: 'var(--orange)', fontSize: 12 }}>▸</span>
                            <span style={{ flex: 1, fontSize: 13 }}>{a.text}</span>
                            {canEdit && (
                              <>
                                <button onClick={() => setEditingAcc({ bikeId: bike.id, accId: a.id, text: a.text })} style={{ color: 'var(--text-muted)', fontSize: 14, padding: '0 2px' }}>✏️</button>
                                <button onClick={() => removeAccessory(bike.id, a.id)} style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 2px' }}>✕</button>
                              </>
                            )}
                          </div>
                        )
                      ))}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 12 }}>
                          <input value={accDraft[bike.id] || ''} onChange={e => setAccDraft(d => ({ ...d, [bike.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addAccessory(bike.id) }}
                            placeholder="Add an accessory / mod…"
                            style={{ flex: 1, background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                          <button onClick={() => addAccessory(bike.id)} style={{ background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '0 14px', borderRadius: 8 }}>Add</button>
                        </div>
                      )}

                      {/* Bike photos */}
                      {bike.photos.length > 1 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
                          {bike.photos.slice(1).map(p => (
                            <div key={p.id} style={{ position: 'relative', aspectRatio: '1' }}>
                              <img src={p.url} alt="" onClick={() => setLightbox(p.url)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, cursor: 'pointer', display: 'block' }} />
                              {canEdit && (
                                <button onClick={() => handleRemoveBikePhoto(bike.id, p.id)}
                                  style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canEdit && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input ref={el => bikePhotoRefs.current[bike.id] = el} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleBikePhoto(e, bike.id)} />
                          <button onClick={() => bikePhotoRefs.current[bike.id]?.click()}
                            style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--gold)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 0' }}>📷 Add Photos</button>
                          <button onClick={() => toggleBikeStatus(bike.id)}
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
                            {sold ? 'Mark owned' : 'Mark sold'}
                          </button>
                          <button onClick={() => handleRemoveBike(bike.id)}
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>Remove</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ============ HELMETS ============ */}
      {section === 'helmets' && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 12 }}>
            🪖 HELMET COLLECTION {(rider.helmets || []).length > 0 && `(${(rider.helmets || []).length})`}
          </p>

          <input ref={helmetPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={addHelmetPhoto} />

          {canEdit && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div onClick={() => helmetRef.current?.click()} style={{
                  width: 54, height: 54, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
                  background: '#111', border: '1px dashed var(--border)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {helmetPreview ? <img src={helmetPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📷'}
                </div>
                <input ref={helmetRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickHelmetPhoto} />
                <input value={helmetName} onChange={e => setHelmetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addHelmet() }}
                  placeholder="Helmet make / model…"
                  style={{ flex: 1, background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
                <button onClick={addHelmet} disabled={savingHelmet}
                  style={{ background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '0 16px', height: 40, borderRadius: 8, flexShrink: 0 }}>
                  {savingHelmet ? '…' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {(rider.helmets || []).length === 0 ? (
            <button onClick={() => canEdit && helmetRef.current?.click()}
              style={{ width: '100%', padding: '24px 0', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🪖</span>
              {canEdit ? 'Add your first helmet' : 'No helmets listed'}
            </button>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {(rider.helmets || []).map(h => (
                <div key={h.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  {h.photo ? (
                    <img src={h.photo} alt={h.name} onClick={() => setLightbox(h.photo)}
                      style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', cursor: 'pointer' }} />
                  ) : (
                    <div
                      onClick={() => { if (canEdit) { setUploadingHelmId(h.id); helmetPhotoRef.current?.click() } }}
                      style={{ height: 120, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, position: 'relative', cursor: canEdit ? 'pointer' : 'default' }}
                    >
                      🪖
                      {canEdit && (
                        <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'var(--orange)', borderRadius: '50%', width: 24, height: 24, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</span>
                      )}
                    </div>
                  )}
                  <div style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{h.name}</div>
                  {canEdit && (
                    <button onClick={() => removeHelmet(h.id)}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ RIDES ============ */}
      {section === 'rides' && (
        <div>
          {upcomingTrips.length === 0 && completedTrips.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No rides yet.</p>
          )}
          {upcomingTrips.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1 }}>UPCOMING RIDES ({upcomingTrips.length})</p>
              {upcomingTrips.map(trip => {
                const p = (trip.participations || []).find(p => p.riderName === rider.name)
                return (
                  <div key={trip.id}>
                    <RideRow trip={trip} status={p?.status} bike={p?.bike} />
                    {canEdit && updateTrip && (
                      <button
                        onClick={() => handleWithdraw(trip.id)}
                        style={{
                          width: '100%', marginTop: 4, marginBottom: 8,
                          fontSize: 12, fontWeight: 600, color: '#e57373',
                          background: '#1a0a0a', border: '1px solid #e57373', borderRadius: 8, padding: '7px 0',
                        }}
                      >Withdraw from ride</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {completedTrips.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1 }}>
                RIDES COMPLETED ({approvedCount} approved / {completedTrips.length} total)
              </p>
              {completedTrips.map(trip => {
                const p = (trip.participations || []).find(p => p.riderName === rider.name)
                return <RideRow key={trip.id} trip={trip} status={p?.status} bike={p?.bike} past />
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ PHOTOS ============ */}
      {section === 'photos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>ALBUM {rider.album.length > 0 && `(${rider.album.length})`}</p>
            {canEdit && (
              <button onClick={() => albumRef.current.click()}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 6, padding: '4px 10px' }}>+ Add Photos</button>
            )}
            <input ref={albumRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleAlbumAdd} />
          </div>
          {rider.album.length === 0 ? (
            <button onClick={() => canEdit && albumRef.current.click()}
              style={{ width: '100%', padding: '28px 0', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🖼️</span>
              {canEdit ? 'Tap to add photos' : 'No photos yet'}
            </button>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {rider.album.map(photo => (
                <div key={photo.id} style={{ position: 'relative', aspectRatio: '1' }}>
                  <img src={photo.url} alt="" onClick={() => setLightbox(photo.url)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, cursor: 'pointer', display: 'block' }} />
                  {canEdit && (
                    <button onClick={() => removeAlbumPhoto(photo.id)}
                      style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}

      {/* ============ ABOUT ============ */}
      {section === 'about' && (
        <div>
          {achievements.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1 }}>🏅 ACHIEVEMENTS</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {achievements.map(b => (
                  <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, background: 'var(--card)', border: `1px solid ${b.color}`, color: b.color, padding: '6px 12px', borderRadius: 20 }}>
                    <span style={{ fontSize: 14 }}>{b.icon}</span> {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {trophies.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1 }}>🏆 TROPHY CASE ({trophies.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {trophies.map(c => (
                  <div key={c.id} onClick={onNavigateToChallenges}
                    style={{ background: 'linear-gradient(135deg, #2a1a0a, var(--card))', border: '1px solid var(--gold)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
                    {c.awardType === 'banner' && c.bannerImage
                      ? <img src={c.bannerImage} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                      : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>{c.trophy}</div>}
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>{c.prizeName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 1 }}>RIDER DETAILS</p>
          <DetailRow label="📅 Joined" value={rider.joined} />
          <DetailRow label="📍 Home Base" editing={editing}
            value={rider.location} input={<input value={edit?.location} onChange={e => setEdit(s => ({ ...s, location: e.target.value }))} style={inputStyle({ width: 160 })} />} />
          <DetailRow label="🛣️ Favorite Road" editing={editing}
            value={rider.favoriteRoad} input={<input value={edit?.favoriteRoad} onChange={e => setEdit(s => ({ ...s, favoriteRoad: e.target.value }))} style={inputStyle({ width: 180 })} />} />
          <DetailRow label="🪖 Helmet" editing={editing}
            value={rider.gear.helmet} input={<input value={edit?.helmet} onChange={e => setEdit(s => ({ ...s, helmet: e.target.value }))} style={inputStyle({ width: 160 })} />} />
          <DetailRow label="🧥 Jacket" editing={editing}
            value={rider.gear.jacket} input={<input value={edit?.jacket} onChange={e => setEdit(s => ({ ...s, jacket: e.target.value }))} style={inputStyle({ width: 160 })} />} />
          <DetailRow label="🩸 Blood Type" editing={editing}
            value={rider.bloodType} input={<input value={edit?.bloodType} onChange={e => setEdit(s => ({ ...s, bloodType: e.target.value }))} style={inputStyle({ width: 70 })} />} />
          <DetailRow label="🚨 Emergency" editing={editing}
            value={`${rider.emergency.name} · ${rider.emergency.phone}`}
            input={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <input value={edit?.emergencyName} onChange={e => setEdit(s => ({ ...s, emergencyName: e.target.value }))} placeholder="Name" style={inputStyle({ width: 160 })} />
                <input value={edit?.emergencyPhone} onChange={e => setEdit(s => ({ ...s, emergencyPhone: e.target.value }))} placeholder="Phone" style={inputStyle({ width: 160 })} />
              </div>
            } />

          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>KNOWN FOR</p>
            {editing ? (
              <input value={edit.tags} onChange={e => setEdit(s => ({ ...s, tags: e.target.value }))} placeholder="comma, separated, tags" style={inputStyle({ width: '100%' })} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rider.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 12, background: '#1f1f1f', color: 'var(--gold)', border: '1px solid #333', padding: '4px 12px', borderRadius: 20 }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {crewBonds.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1 }}>🤝 RIDES WITH</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {crewBonds.map(b => (
                  <div key={b.name} style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                    {b.rider && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Avatar rider={b.rider} size={40} /></div>}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{b.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 10, color: 'var(--orange)' }}>{b.count} ride{b.count > 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Personal activity timeline (the profile's "feed")
function ActivityFeed({ rider, myPosts, trophies, completedTrips, upcomingTrips, onNavigateToFeed, onNavigateToChallenges }) {
  const empty = !myPosts.length && !trophies.length && !completedTrips.length && !upcomingTrips.length
  if (empty) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '28px 0' }}>
      Nothing here yet — {rider.name.split(' ')[0]}'s posts and rides will show up in this feed.
    </p>
  }
  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 10 }
  return (
    <div>
      {myPosts.map(post => (
        <div key={'p' + post.id} onClick={onNavigateToFeed} style={{ ...card, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Avatar rider={rider} size={32} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{rider.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>posted</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{post.time}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#ddd', lineHeight: 1.6, marginBottom: post.image ? 10 : 0 }}>{post.text}</p>
          {post.image && <img src={post.image} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, display: 'block' }} />}
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
            <span>🔥 {post.likes}</span><span>💬 {(post.replies || []).length}</span>
          </div>
        </div>
      ))}

      {trophies.map(c => (
        <div key={'t' + c.id} onClick={onNavigateToChallenges} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--gold)' }}>
          <span style={{ fontSize: 30 }}>{c.awardType === 'banner' ? '🏆' : c.trophy}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Won <span style={{ color: 'var(--gold)' }}>{c.prizeName}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>in the {c.title} challenge</div>
          </div>
        </div>
      ))}

      {completedTrips.map(t => (
        <div key={'c' + t.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>✅</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Completed <span style={{ color: 'var(--orange)' }}>{t.name}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date} · {t.distance}</div>
          </div>
        </div>
      ))}

      {upcomingTrips.map(t => (
        <div key={'u' + t.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🏍️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Joined upcoming ride <span style={{ color: 'var(--orange)' }}>{t.name}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const fLabel = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const fInput = { width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13 }

function inputStyle(extra = {}) {
  return { background: '#111', border: '1px solid var(--orange)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', ...extra }
}

function StatBox({ label, value }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function DetailRow({ label, value, editing, input }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '12px 0', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      {editing && input ? input : <span style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>{value}</span>}
    </div>
  )
}

const STATUS_COLOR = { requested: 'var(--text-muted)', attended: 'var(--gold)', approved: '#4caf50' }
const STATUS_LABEL = { requested: 'Joined', attended: 'Pending approval', approved: '✓ Approved' }

function RideRow({ trip, status, bike, past }) {
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${past ? 'var(--border)' : 'var(--orange)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, opacity: past && status !== 'approved' ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{trip.name}</span>
        {status && <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📅 {trip.date}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {trip.distance}</span>
      </div>
      {bike && <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 3 }}>🏍️ Riding: {bike}</div>}
      {trip.from && trip.to && (
        <div style={{ fontSize: 11, marginTop: 3 }}>
          <span style={{ color: 'var(--orange)' }}>{trip.from}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 5px' }}>→</span>
          <span style={{ color: 'var(--gold)' }}>{trip.to}</span>
        </div>
      )}
    </div>
  )
}
