import { useState, useEffect, useRef } from 'react'
import RouteMap, { PlaceMap } from '../components/RouteMap.jsx'
import { shareToWhatsApp } from '../utils/share.js'
import { fetchTripWeather } from '../lib/weather.js'
import { downloadTripICS } from '../lib/calendar.js'
import { uploadImage } from '../lib/upload.js'
import PlaceInput from '../components/PlaceInput.jsx'

const STATUS_LABEL = { requested: 'Joined', attended: 'Attendance Confirmed', approved: 'Approved ✓' }
const STATUS_COLOR = { requested: 'var(--text-muted)', attended: 'var(--gold)', approved: '#4caf50' }

// Trip classifications (ride type) with badge colors
const CLASSIFICATIONS = [
  { value: 'Day Ride',   icon: '☀️', bg: '#1a2a1a', color: '#4caf50' },
  { value: 'Multi-Day',  icon: '🏕️', bg: '#1a1a2a', color: '#7986cb' },
  { value: 'Touring',    icon: '🛣️', bg: '#2a1a0a', color: 'var(--gold)' },
  { value: 'Charity',    icon: '🖤', bg: '#2a0a1a', color: '#e57399' },
  { value: 'Track Day',  icon: '🏁', bg: '#2a1010', color: '#e53935' },
  { value: 'Cruise',     icon: '🌅', bg: '#0a1a2a', color: '#4fc3f7' },
  { value: 'International', icon: '🌍', bg: '#0a2a1a', color: '#26c6da' },
]
const CLASS_MAP = Object.fromEntries(CLASSIFICATIONS.map(c => [c.value, c]))

/* --- Closed trips ---------------------------------------------------- */
// A trip whose date has passed is closed: nobody can join anymore, but its
// details and rider list stay viewable.
function parseTripEndDate(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  // Form-created trips: "YYYY-MM-DD" — parse as a LOCAL date, not UTC
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3])
  // Seeded/legacy formats like "Jul 12, 2025"; ranges like "Aug 4–10, 2025"
  // collapse to the last day of the range.
  const t = Date.parse(s.replace(/(\d+)\s*[–—-]\s*(\d+)/, '$2'))
  return Number.isNaN(t) ? null : new Date(t)
}

export function isTripClosed(trip) {
  if (trip?.status !== 'upcoming') return false
  const end = parseTripEndDate(trip.date)
  if (!end) return false
  // Closed from midnight AFTER the trip's (last) day — the ride day itself still counts.
  return Date.now() >= new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime()
}

function ClosedBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: '#1a1a1a', color: 'var(--text-muted)', border: '1px solid var(--border)',
      whiteSpace: 'nowrap',
    }}>🔒 Closed</span>
  )
}

function ExternalBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
      background: '#1a1a2a', color: '#9fa8da', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>🌐 External</span>
  )
}

function ClassBadge({ value, size = 'sm' }) {
  const c = CLASS_MAP[value]
  if (!c) return null
  const pad = size === 'lg' ? '4px 10px' : '2px 8px'
  const fs = size === 'lg' ? 11 : 10
  return (
    <span style={{
      fontSize: fs, fontWeight: 600, padding: pad, borderRadius: 6,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>{c.icon} {c.value}</span>
  )
}

// Fire a real browser/PWA notification if the user has granted permission
function notifyBrowser(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png' })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body, icon: '/icon-192.png' })
    })
  }
}

export default function Trips({ trips, updateTrip, addTrip, removeTrip, currentRider, isAdmin, addNotification, myBikes = [], riders = [] }) {
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [reminders, setReminders] = useState({}) // { [`${tripId}:${rider}`]: true }

  function reminderKey(tripId) { return `${tripId}:${currentRider}` }
  function hasReminder(tripId) { return !!reminders[reminderKey(tripId)] }

  function toggleReminder(trip) {
    const key = reminderKey(trip.id)
    setReminders(prev => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
      } else {
        next[key] = true
        addNotification?.({
          id: Date.now() + Math.random(),
          rider: currentRider,
          text: `🔔 Reminder set for "${trip.name}" on ${trip.date}. Meet at ${trip.meeting || 'TBD'}.`,
          time: 'just now',
          tab: 'trips',
        })
        notifyBrowser(`Reminder set: ${trip.name}`, `${trip.date} · meet at ${trip.meeting || 'TBD'}`)
      }
      return next
    })
  }
  const EMPTY_FORM = { name: '', date: '', gatherTime: '', rollTime: '', distance: '', classification: 'Day Ride', from: '', fromLat: null, fromLng: null, to: '', toLat: null, toLng: null, meeting: '', meetingLat: null, meetingLng: null, comment: '', notes: '', external: false, completed: false, visibility: 'public', allowedRiders: [] }
  const [riderSearch, setRiderSearch] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  function handleAdd() {
    if (!form.name || !form.date) return
    const { external, completed, visibility, allowedRiders, ...rest } = form
    addTrip({
      id: Date.now(), ...rest,
      external,
      status: completed ? 'completed' : 'upcoming',
      participations: [{ riderName: currentRider, status: completed ? 'approved' : 'requested' }],
      photos: [],
      visibility: visibility || 'public',
      allowedRiders: visibility === 'private' ? allowedRiders : [],
      createdBy: currentRider,
      meetingUrl: form.meetingLat ? `https://www.google.com/maps?q=${form.meetingLat},${form.meetingLng}` : null,
    })
    setForm(EMPTY_FORM)
    setRiderSearch('')
    setShowForm(false)
  }

  function toggleAllowedRider(name) {
    setForm(f => ({
      ...f,
      allowedRiders: f.allowedRiders.includes(name)
        ? f.allowedRiders.filter(n => n !== name)
        : [...f.allowedRiders, name],
    }))
  }

  function canSeeTrip(trip) {
    if (!trip.visibility || trip.visibility === 'public') return true
    if (isAdmin) return true
    if (trip.createdBy === currentRider) return true
    return (trip.allowedRiders || []).includes(currentRider)
  }

  function myParticipation(trip) {
    return trip.participations?.find(p => p.riderName === currentRider)
  }

  function handleJoin(tripId, bike) {
    const trip = trips.find(t => t.id === tripId)
    if (!trip || isTripClosed(trip)) return // date passed — joining is closed
    updateTrip(tripId, {
      participations: [...(trip.participations || []), { riderName: currentRider, status: 'requested', bike: bike || null }],
    })
  }

  function handleConfirmAttendance(tripId) {
    const trip = trips.find(t => t.id === tripId)
    updateTrip(tripId, {
      participations: trip.participations.map(p =>
        p.riderName === currentRider ? { ...p, status: 'attended' } : p
      ),
    })
  }

  function handleApprove(tripId, riderName) {
    const trip = trips.find(t => t.id === tripId)
    updateTrip(tripId, {
      participations: trip.participations.map(p =>
        p.riderName === riderName ? { ...p, status: 'approved' } : p
      ),
    })
  }

  function handleReject(tripId, riderName) {
    const trip = trips.find(t => t.id === tripId)
    updateTrip(tripId, {
      participations: trip.participations.filter(p => p.riderName !== riderName),
    })
  }

  function handleReactivate(trip) {
    setForm({
      name: trip.name,
      date: '',
      gatherTime: trip.gatherTime || '',
      rollTime: trip.rollTime || '',
      distance: trip.distance || '',
      classification: trip.classification || 'Day Ride',
      from: trip.from || '',
      fromLat: trip.fromLat || null,
      fromLng: trip.fromLng || null,
      to: trip.to || '',
      toLat: trip.toLat || null,
      toLng: trip.toLng || null,
      meeting: trip.meeting || '',
      meetingLat: trip.meetingLat || null,
      meetingLng: trip.meetingLng || null,
      comment: trip.comment || '',
      notes: trip.notes || '',
      external: trip.external || false,
      completed: false,
      visibility: trip.visibility || 'public',
      allowedRiders: trip.allowedRiders || [],
    })
    setShowForm(true)
    setSelected(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Admin: all pending attended confirmations across all trips
  const pendingApprovals = isAdmin
    ? trips.flatMap(t => (t.participations || [])
        .filter(p => p.status === 'attended')
        .map(p => ({ ...p, tripId: t.id, tripName: t.name, tripDate: t.date })))
    : []

  if (selected) {
    const trip = trips.find(t => t.id === selected)
    const mine = myParticipation(trip)
    return (
      <TripDetail
        trip={trip}
        mine={mine}
        currentRider={currentRider}
        isAdmin={isAdmin}
        reminderOn={hasReminder(trip.id)}
        onToggleReminder={() => toggleReminder(trip)}
        onUpdateTrip={(patch) => updateTrip(trip.id, patch)}
        myBikes={myBikes}
        onBack={() => setSelected(null)}
        onJoin={(bike) => handleJoin(trip.id, bike)}
        onWithdraw={() => handleReject(trip.id, currentRider)}
        onConfirm={() => handleConfirmAttendance(trip.id)}
        onApprove={(name) => handleApprove(trip.id, name)}
        onReject={(name) => handleReject(trip.id, name)}
        onReactivate={() => handleReactivate(trip)}
        onDelete={() => removeTrip(trip.id)}
      />
    )
  }

  const visible = trips.filter(canSeeTrip)
  const upcoming = visible.filter(t => t.status === 'upcoming' && !isTripClosed(t))
  const closedTrips = visible.filter(t => t.status === 'upcoming' && isTripClosed(t))
  const past = visible.filter(t => t.status === 'completed')

  return (
    <div style={{ padding: 16 }}>
      {/* Admin approval banner */}
      {isAdmin && pendingApprovals.length > 0 && (
        <div style={{ background: '#1a1500', border: '1px solid var(--gold)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 10, letterSpacing: 1 }}>
            ⏳ PENDING APPROVALS ({pendingApprovals.length})
          </p>
          {pendingApprovals.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{p.riderName}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.tripName} · {p.tripDate}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleApprove(p.tripId, p.riderName)}
                  style={{ fontSize: 11, fontWeight: 700, color: '#4caf50', border: '1px solid #4caf50', borderRadius: 6, padding: '4px 10px' }}>
                  Approve
                </button>
                <button onClick={() => handleReject(p.tripId, p.riderName)}
                  style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>UPCOMING TRIPS</h2>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
          + Add Trip
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {/* Trip name */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Trip name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }} />
          </div>

          {/* Date — calendar picker */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, colorScheme: 'dark' }} />
          </div>

          {/* Gathering Time + Rolling Time side by side */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Gathering Time</label>
              <input type="time" value={form.gatherTime} onChange={e => setForm(f => ({ ...f, gatherTime: e.target.value }))}
                style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, colorScheme: 'dark' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Rolling Time</label>
              <input type="time" value={form.rollTime} onChange={e => setForm(f => ({ ...f, rollTime: e.target.value }))}
                style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, colorScheme: 'dark' }} />
            </div>
          </div>

          {/* Distance */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Distance (km)</label>
            <input value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value }))}
              placeholder="e.g. 320 km"
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }} />
          </div>

          {/* Classification */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Classification</label>
            <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}>
              {CLASSIFICATIONS.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.value}</option>
              ))}
            </select>
          </div>

          {[
            ['From (search a place)', 'from', 'fromLat', 'fromLng', 'e.g. Phoenix, AZ'],
            ['To (search a place)',   'to',   'toLat',   'toLng',   'e.g. Sedona, AZ'],
            ['Meeting point',         'meeting', 'meetingLat', 'meetingLng', 'e.g. Hog Heaven Diner, Phoenix'],
          ].map(([label, key, latKey, lngKey, ph]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <PlaceInput
                value={form[key]}
                onChange={val => setForm(f => ({ ...f, [key]: val }))}
                onCoords={c => setForm(f => ({ ...f, [latKey]: c?.lat ?? null, [lngKey]: c?.lng ?? null }))}
                placeholder={ph}
                style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}
              />
            </div>
          ))}

          {/* Live Google Maps preview of the route */}
          {(form.from || form.to) && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                📍 MAP PREVIEW
              </label>
              {form.from && form.to ? (
                <RouteMap from={form.from} to={form.to} height={160} />
              ) : (
                <PlaceMap query={form.from || form.to} height={160} />
              )}
            </div>
          )}

          {/* Meeting point map preview */}
          {form.meeting && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                🤝 MEETING POINT PREVIEW
              </label>
              <PlaceMap query={form.meeting} height={160} />
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, resize: 'none' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Comment (shown in WhatsApp share)</label>
            <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} rows={2}
              placeholder="e.g. Dress code: all black. Bring water!"
              style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, resize: 'none' }} />
          </div>

          {/* External / past ride toggles */}
          <CheckRow checked={form.external} onToggle={() => setForm(f => ({ ...f, external: !f.external }))}
            label="🌐 Organized outside the app" hint="e.g. an international tour or another club's ride" />
          <CheckRow checked={form.completed} onToggle={() => setForm(f => ({ ...f, completed: !f.completed }))}
            label="✅ Already happened (log a past ride)" hint="Adds it straight to Past Rides, you marked as attended" />

          {/* Visibility */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Visibility</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: form.visibility === 'private' ? 10 : 0 }}>
              {[['public', '🌍 Public'], ['private', '🔒 Private']].map(([val, label]) => {
                const active = form.visibility === val
                return (
                  <button
                    key={val}
                    onClick={() => setForm(f => ({ ...f, visibility: val, allowedRiders: [] }))}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 600, fontSize: 12,
                      background: active ? (val === 'private' ? '#1a0a0a' : '#0a1a0a') : '#111',
                      color: active ? (val === 'private' ? '#e57373' : '#4caf50') : 'var(--text-muted)',
                      border: `1px solid ${active ? (val === 'private' ? '#e57373' : '#4caf50') : 'var(--border)'}`,
                    }}
                  >{label}</button>
                )
              })}
            </div>

            {/* Private rider picker */}
            {form.visibility === 'private' && (
              <div style={{ background: '#0d0d0d', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Select riders who can see this trip</p>
                <input
                  value={riderSearch}
                  onChange={e => setRiderSearch(e.target.value)}
                  placeholder="Search riders..."
                  style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, marginBottom: 8 }}
                />
                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {riders
                    .filter(r => r.name !== currentRider)
                    .filter(r => !riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase()))
                    .map(r => {
                      const sel = form.allowedRiders.includes(r.name)
                      return (
                        <button
                          key={r.id}
                          onClick={() => toggleAllowedRider(r.name)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 10px', borderRadius: 8, textAlign: 'left',
                            background: sel ? 'rgba(229,115,115,0.12)' : '#111',
                            border: `1px solid ${sel ? '#e57373' : 'var(--border)'}`,
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{r.avatar || '👤'}</span>
                          <span style={{ flex: 1, fontSize: 13 }}>{r.name}</span>
                          {sel && <span style={{ color: '#e57373', fontWeight: 700 }}>✓</span>}
                        </button>
                      )
                    })}
                </div>
                {form.allowedRiders.length > 0 && (
                  <p style={{ fontSize: 11, color: '#e57373', marginTop: 6 }}>
                    {form.allowedRiders.length} rider{form.allowedRiders.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
          </div>

          <button onClick={handleAdd}
            style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 600, fontSize: 14, padding: 10, borderRadius: 8, marginTop: 4 }}>
            {form.completed ? 'Log This Ride' : form.external ? 'Add External Trip' : 'Add Trip'}
          </button>
        </div>
      )}

      {upcoming.map(trip => (
        <TripCard key={trip.id} trip={trip} mine={myParticipation(trip)} onSelect={() => setSelected(trip.id)} onJoin={() => handleJoin(trip.id, '')} />
      ))}

      {closedTrips.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', margin: '20px 0 12px', letterSpacing: 1 }}>🔒 CLOSED RIDES</h2>
          {closedTrips.map(trip => (
            <TripCard key={trip.id} trip={trip} mine={myParticipation(trip)} closed onSelect={() => setSelected(trip.id)} onReactivate={() => handleReactivate(trip)} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', margin: '20px 0 12px', letterSpacing: 1 }}>PAST RIDES</h2>
          {past.map(trip => (
            <TripCard key={trip.id} trip={trip} mine={myParticipation(trip)} past onSelect={() => setSelected(trip.id)} onReactivate={() => handleReactivate(trip)} />
          ))}
        </>
      )}
    </div>
  )
}

function TripCard({ trip, mine, past, closed, onSelect, onJoin, onReactivate }) {
  const approved = (trip.participations || []).filter(p => p.status === 'approved').length
  const total = (trip.participations || []).length
  return (
    <div style={{
      background: 'var(--card)', border: `1px solid ${past || closed ? 'var(--border)' : 'var(--orange)'}`,
      borderRadius: 12, marginBottom: 12, opacity: past ? 0.7 : closed ? 0.85 : 1, overflow: 'hidden',
    }}>
      <button onClick={onSelect} style={{ width: '100%', textAlign: 'left', padding: 16, display: 'block' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{trip.name}</h3>
            {trip.classification && <ClassBadge value={trip.classification} />}
            {closed && <ClosedBadge />}
            {trip.external && <ExternalBadge />}
            {trip.visibility === 'private' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#1a0505', color: '#e57373', border: '1px solid #4a1010' }}>🔒 Private</span>
            )}
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>›</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
          <Stat icon="📅" label={trip.date} />
          {trip.gatherTime && <Stat icon="🕐" label={`Gather ${trip.gatherTime}`} />}
          {trip.rollTime && <Stat icon="🏍️" label={`Roll ${trip.rollTime}`} />}
          {trip.distance && <Stat icon="📏" label={trip.distance} />}
        </div>
        {trip.from && trip.to && (
          <p style={{ fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: 'var(--orange)' }}>{trip.from}</span>
            <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
            <span style={{ color: 'var(--gold)' }}>{trip.to}</span>
          </p>
        )}
        {trip.comment && (
          <p style={{ fontSize: 12, color: '#4fc3f7', marginBottom: 6 }}>💬 {trip.comment}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {past ? `${approved} approved` : `${total} joined`}
            {(trip.discussion || []).length > 0 && ` · 💬 ${trip.discussion.length}`}
            {(trip.photos || []).length > 0 && ` · 📸 ${trip.photos.length}`}
          </span>
          {mine && (
            <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[mine.status] }}>
              {STATUS_LABEL[mine.status]}
            </span>
          )}
        </div>
      </button>
      {/* Quick join button — only for open upcoming trips where rider hasn't joined yet */}
      {!past && !closed && !mine && onJoin && (
        <button onClick={e => { e.stopPropagation(); onJoin() }}
          style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          🏍️ Join This Ride
        </button>
      )}
      {/* Rerun button on past/closed trips */}
      {(past || closed) && onReactivate && (
        <button onClick={e => { e.stopPropagation(); onReactivate() }}
          style={{ width: '100%', background: '#1a1a1a', color: 'var(--gold)', fontWeight: 700, fontSize: 13, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
          🔁 Rerun This Trip
        </button>
      )}
    </div>
  )
}

function TripDetail({ trip, mine, currentRider, isAdmin, reminderOn, onToggleReminder, onUpdateTrip, myBikes = [], onBack, onJoin, onWithdraw, onConfirm, onApprove, onReject, onReactivate, onDelete }) {
  const participants = trip.participations || []
  const pendingHere = isAdmin ? participants.filter(p => p.status === 'attended') : []
  const closed = isTripClosed(trip)
  const photos = trip.photos || []
  const discussion = trip.discussion || []

  const [weather, setWeather] = useState(null)
  const [photoLightbox, setPhotoLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [chosenBike, setChosenBike] = useState(myBikes[0] || '')
  const [chatText, setChatText] = useState('')
  const photoRef = useRef()

  useEffect(() => {
    let active = true
    setWeather(null)
    const place = trip.to || trip.from || trip.meeting
    if (place && trip.date) {
      fetchTripWeather(place, trip.date).then(w => { if (active) setWeather(w) })
    }
    return () => { active = false }
  }, [trip.to, trip.from, trip.meeting, trip.date])

  async function handleAddPhotos(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      const added = await Promise.all(files.map(async f => ({
        id: Date.now() + Math.random(),
        url: await uploadImage(f, 'trips'),
        by: currentRider,
      })))
      onUpdateTrip({ photos: [...photos, ...added] })
    } finally {
      setUploading(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  function removePhoto(id) {
    onUpdateTrip({ photos: photos.filter(p => p.id !== id) })
  }

  function postComment() {
    const text = chatText.trim()
    if (!text) return
    onUpdateTrip({
      discussion: [...discussion, {
        id: Date.now() + Math.random(),
        by: currentRider,
        text,
        at: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }],
    })
    setChatText('')
  }

  function removeComment(id) {
    onUpdateTrip({ discussion: discussion.filter(c => c.id !== id) })
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ color: 'var(--orange)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          ‹ Back
        </button>
        {isAdmin && (
          <button onClick={() => { if (window.confirm('Delete this trip?')) { onDelete(); onBack() } }}
            style={{ fontSize: 12, fontWeight: 600, color: '#e57373', border: '1px solid #e57373', borderRadius: 8, padding: '5px 12px' }}>
            🗑 Delete Trip
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{trip.name}</h2>
        <button
          onClick={() => shareToWhatsApp([
            `🏍️ *${trip.name}*`,
            `📅 ${trip.date}${trip.gatherTime ? ` · Gather ${trip.gatherTime}` : ''}${trip.rollTime ? ` · Roll ${trip.rollTime}` : ''}`,
            trip.distance ? `📏 ${trip.distance}` : '',
            trip.from && trip.to ? `📍 ${trip.from} → ${trip.to}` : '',
            trip.meeting ? `🤝 Meeting point: ${trip.meeting}` : '',
            trip.meetingLat ? `📍 Maps: https://www.google.com/maps?q=${trip.meetingLat},${trip.meetingLng}` : '',
            trip.comment ? `\n💬 ${trip.comment}` : '',
            trip.notes ? `📝 ${trip.notes}` : '',
            `\n👉 Join the crew: https://road-heaven.vercel.app`,
          ].filter(Boolean).join('\n'))}
          style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#25D366', fontWeight: 600, fontSize: 13, flexShrink: 0, marginLeft: 12 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.428a.75.75 0 0 0 .916.916l5.569-1.476A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 0 1-4.953-1.355l-.355-.211-3.676.974.974-3.564-.229-.368A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
          </svg>
          Share
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trip.date} · {trip.distance}</p>
        {trip.classification && <ClassBadge value={trip.classification} size="lg" />}
        {trip.external && <ExternalBadge />}
      </div>
      {(trip.gatherTime || trip.rollTime) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {trip.gatherTime && <Stat icon="🕐" label={`Gather ${trip.gatherTime}`} />}
          {trip.rollTime && <Stat icon="🏍️" label={`Roll ${trip.rollTime}`} />}
        </div>
      )}
      {trip.comment && (
        <div style={{ background: '#0a1a2a', border: '1px solid #1a3a5a', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#4fc3f7', marginBottom: 2, fontWeight: 700, letterSpacing: 0.5 }}>💬 COMMENT</p>
          <p style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6 }}>{trip.comment}</p>
        </div>
      )}

      {/* Weather + add to calendar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <WeatherCard weather={weather} />
        <button
          onClick={() => downloadTripICS(trip)}
          style={{
            flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '0 14px', color: 'var(--text)', fontSize: 12, fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          }}
          title="Add to your calendar"
        >
          <span style={{ fontSize: 18 }}>📅</span>
          Calendar
        </button>
      </div>

      {/* Closed notice — date passed, joining is over but details stay viewable */}
      {closed && (
        <div style={{ background: '#1a1a1a', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700 }}>This ride is closed</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>The date has passed — no new joins. Rider list below.</p>
          </div>
        </div>
      )}

      {/* My action button */}
      {trip.status === 'upcoming' && !closed && !mine && (
        <div style={{ marginBottom: 16 }}>
          {myBikes.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>🏍️ WHICH BIKE ARE YOU RIDING?</label>
              <select value={chosenBike} onChange={e => setChosenBike(e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }}>
                {myBikes.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => onJoin(chosenBike)} style={{ width: '100%', background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 10 }}>
            🏍️ Join This Ride
          </button>
        </div>
      )}
      {trip.status === 'upcoming' && mine && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#0a2a0a', border: '1px solid #4caf50', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#4caf50' }}>{closed ? 'You were on this ride' : "You're in"}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Status: {STATUS_LABEL[mine.status]}{mine.bike ? ` · Riding ${mine.bike}` : ''}
              </p>
            </div>
          </div>
          {!closed && (
            <button
              onClick={onWithdraw}
              style={{ width: '100%', fontSize: 13, fontWeight: 600, color: '#e57373', background: '#1a0a0a', border: '1px solid #e57373', borderRadius: 10, padding: '10px 0' }}
            >Withdraw from this ride</button>
          )}
        </div>
      )}
      {trip.status === 'completed' && mine?.status === 'requested' && (
        <button onClick={onConfirm} style={{ width: '100%', background: 'var(--gold)', color: '#111', fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 10, marginBottom: 16 }}>
          ✋ Confirm I Attended This Ride
        </button>
      )}
      {trip.status === 'completed' && mine?.status === 'attended' && (
        <div style={{ background: '#1a1500', border: '1px solid var(--gold)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>⏳ Attendance pending admin approval</p>
        </div>
      )}
      {trip.status === 'completed' && mine?.status === 'approved' && (
        <div style={{ background: '#0a2a0a', border: '1px solid #4caf50', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#4caf50' }}>✓ Attendance approved</p>
        </div>
      )}
      {(trip.status === 'completed' || closed) && (
        <button onClick={onReactivate}
          style={{ width: '100%', marginBottom: 16, fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 10, background: '#1a1500', border: '1px solid var(--gold)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🔁 Rerun This Trip with a New Date
        </button>
      )}

      {/* Reminder toggle for open upcoming rides */}
      {trip.status === 'upcoming' && !closed && (
        <button onClick={onToggleReminder}
          style={{
            width: '100%', marginBottom: 16, fontWeight: 600, fontSize: 14, padding: 12, borderRadius: 10,
            background: reminderOn ? 'rgba(255,184,0,0.12)' : 'var(--card)',
            border: `1px solid ${reminderOn ? 'var(--gold)' : 'var(--border)'}`,
            color: reminderOn ? 'var(--gold)' : 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {reminderOn ? '🔔 Reminder set — tap to remove' : '🔔 Remind Me About This Ride'}
        </button>
      )}

      {/* Admin approvals for this trip */}
      {isAdmin && pendingHere.length > 0 && (
        <div style={{ background: '#1a1500', border: '1px solid var(--gold)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 10, letterSpacing: 1 }}>PENDING APPROVALS</p>
          {pendingHere.map(p => (
            <div key={p.riderName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{p.riderName}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onApprove(p.riderName)}
                  style={{ fontSize: 11, fontWeight: 700, color: '#4caf50', border: '1px solid #4caf50', borderRadius: 6, padding: '4px 10px' }}>
                  Approve
                </button>
                <button onClick={() => onReject(p.riderName)}
                  style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {trip.from && trip.to && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{trip.from}</span>
            <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
            <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{trip.to}</span>
          </p>
          <RouteMap from={trip.from} to={trip.to} height={220} />
        </div>
      )}

      {trip.meeting && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>MEETING POINT</p>
            <p style={{ fontSize: 14, marginBottom: 10 }}>🤝 {trip.meeting}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={trip.meetingLat
                  ? `https://www.google.com/maps/dir/?api=1&destination=${trip.meetingLat},${trip.meetingLng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.meeting)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#0a1a0a', border: '1px solid #4caf50', borderRadius: 8,
                  padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#4caf50',
                }}
              >📍 Get Directions</a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `🤝 Meeting point: ${trip.meeting}\n📍 ${
                    trip.meetingLat
                      ? `https://www.google.com/maps?q=${trip.meetingLat},${trip.meetingLng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.meeting)}`
                  }`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#0a1a10', border: '1px solid #25D366', borderRadius: 8,
                  padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#25D366',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.428a.75.75 0 0 0 .916.916l5.569-1.476A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 0 1-4.953-1.355l-.355-.211-3.676.974.974-3.564-.229-.368A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                Share
              </a>
            </div>
          </div>
          <PlaceMap query={trip.meetingLat ? `${trip.meetingLat},${trip.meetingLng}` : trip.meeting} height={180} />
        </div>
      )}

      {trip.notes && (
        <div style={{ background: '#1a1500', border: '1px solid #2a2000', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 4 }}>NOTES</p>
          <p style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6 }}>{trip.notes}</p>
        </div>
      )}

      {/* Trip photo gallery */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
            📸 RIDE GALLERY {photos.length > 0 && `(${photos.length})`}
          </p>
          <button onClick={() => photoRef.current?.click()} disabled={uploading}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 6, padding: '4px 10px' }}>
            {uploading ? 'Uploading…' : '+ Add Photos'}
          </button>
          <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleAddPhotos} />
        </div>
        {photos.length === 0 ? (
          <button onClick={() => photoRef.current?.click()}
            style={{ width: '100%', padding: '24px 0', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 26 }}>📷</span>
            Share photos from this ride
          </button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {photos.map(ph => (
              <div key={ph.id} style={{ position: 'relative', aspectRatio: '1' }}>
                <img src={ph.url} alt="" onClick={() => setPhotoLightbox(ph)} loading="lazy" decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, cursor: 'pointer', display: 'block' }} />
                {ph.by && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', borderRadius: '0 0 6px 6px', padding: '10px 4px 3px', fontSize: 9, color: 'rgba(255,255,255,0.85)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                    {ph.by}
                  </div>
                )}
                {(isAdmin || ph.by === currentRider) && (
                  <button onClick={() => removePhoto(ph.id)}
                    style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {photoLightbox && (
        <div onClick={() => setPhotoLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <img src={photoLightbox.url} alt="" style={{ maxWidth: '95vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }} />
          {photoLightbox.by && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>📷 {photoLightbox.by}</p>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>
          RIDERS ({participants.length})
        </p>
        {participants.map(p => (
          <div key={p.riderName} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 8,
          }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13 }}>{p.riderName}</span>
              {p.bike && <div style={{ fontSize: 11, color: 'var(--gold)' }}>🏍️ {p.bike}</div>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[p.status], flexShrink: 0 }}>
              {STATUS_LABEL[p.status]}
            </span>
          </div>
        ))}
      </div>

      {/* Ride discussion — open on every trip; on closed rides this and the
          gallery are the only actions left. */}
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>
          💬 RIDE DISCUSSION{discussion.length > 0 ? ` (${discussion.length})` : ''}
        </p>
        {discussion.map(c => (
          <div key={c.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.by === currentRider ? 'var(--orange)' : 'var(--gold)' }}>{c.by}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                {c.at}
                {(c.by === currentRider || isAdmin) && (
                  <button onClick={() => removeComment(c.id)}
                    style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 11 }}>✕</button>
                )}
              </span>
            </div>
            <p style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.text}</p>
          </div>
        ))}
        {discussion.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {closed ? 'How was the ride? Share your stories below.' : 'No messages yet — start the conversation.'}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={chatText} onChange={e => setChatText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') postComment() }}
            placeholder={closed ? 'Share how the ride went…' : 'Say something about this ride…'}
            style={{ flex: 1, minWidth: 0, background: '#111', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
          <button onClick={postComment} disabled={!chatText.trim()}
            style={{ background: 'var(--orange)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '0 16px', borderRadius: 8, opacity: chatText.trim() ? 1 : 0.5 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon} {label}
    </span>
  )
}

function CheckRow({ checked, onToggle, label, hint }) {
  return (
    <button onClick={onToggle} style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
      background: checked ? 'rgba(255,107,0,0.08)' : '#111',
      border: `1px solid ${checked ? 'var(--orange)' : 'var(--border)'}`,
      borderRadius: 8, padding: '10px 12px', marginBottom: 8,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
        border: `2px solid ${checked ? 'var(--orange)' : 'var(--text-muted)'}`,
        background: checked ? 'var(--orange)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 12, fontWeight: 700,
      }}>{checked ? '✓' : ''}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
      </span>
    </button>
  )
}

function WeatherCard({ weather }) {
  const base = {
    flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
  }
  if (!weather) {
    return <div style={{ ...base, color: 'var(--text-muted)', fontSize: 12 }}>🌡️ Checking forecast…</div>
  }
  if (weather.unavailable) {
    const text = weather.unavailable === 'far'
      ? 'Forecast opens ~2 weeks out'
      : weather.unavailable === 'past'
        ? 'Past ride'
        : 'Forecast unavailable'
    return <div style={{ ...base, color: 'var(--text-muted)', fontSize: 12 }}>🗓️ {text}</div>
  }
  return (
    <div style={base}>
      <span style={{ fontSize: 30, lineHeight: 1 }}>{weather.emoji}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {weather.hi}° <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {weather.lo}°</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {weather.label}{weather.rain != null ? ` · 💧${weather.rain}%` : ''}
        </div>
      </div>
    </div>
  )
}
