import { useState, useEffect } from 'react'
import CrewShell from './CrewShell.jsx'
import { useAuth } from './lib/AuthContext.jsx'
import { useCollection } from './lib/useCollection.js'
import { useProfiles } from './lib/useProfiles.js'
import { supabase } from './lib/supabase.js'
import AuthScreen from './auth/AuthScreen.jsx'
import PendingScreen from './auth/PendingScreen.jsx'
import { TRIPS } from './data/trips.js'
import { INITIAL_POSTS } from './data/posts.js'
import { INITIAL_CHALLENGES } from './data/challenges.js'
import { INITIAL_GEAR } from './data/gear.js'
import { INITIAL_RIDERS } from './tabs/Riders.jsx'
import { INITIAL_LISTINGS } from './data/marketplace.js'

function Splash() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg)' }}>
      <span style={{ fontSize: 38 }}>🏍️</span>
      {slow && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Taking longer than usual…</p>
          <button
            onClick={() => window.location.reload()}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 8, padding: '8px 20px' }}
          >
            Tap to retry
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const auth = useAuth()

  // No backend configured → full-featured DEMO mode (no login, local data).
  if (!auth.isConfigured) return <DemoApp />

  // Backend configured → real shared app with auth + approval gate.
  if (auth.loading) return <Splash />
  if (!auth.session) return <AuthScreen />
  if (!auth.isApproved) return <PendingScreen />
  return <LiveApp />
}

/* ------------------------------------------------------------------ */
/* DEMO MODE — everything in memory, seeded with sample content        */
/* ------------------------------------------------------------------ */
const RIDER_NAMES = INITIAL_RIDERS.map(r => r.name)

function DemoApp() {
  const [currentRider, setCurrentRider] = useState(RIDER_NAMES[0])
  const [isAdmin, setIsAdmin] = useState(false)
  const [trips, setTrips] = useState(TRIPS)
  const [posts, setPosts] = useState(INITIAL_POSTS)
  const [challenges, setChallenges] = useState(INITIAL_CHALLENGES)
  const [gear, setGear] = useState(INITIAL_GEAR)
  const [riders, setRiders] = useState(INITIAL_RIDERS)
  const [listings, setListings] = useState(INITIAL_LISTINGS)
  const [notifications, setNotifications] = useState([])
  const [messages, setMessages] = useState([])

  const myNotifications = notifications.filter(n => n.rider === currentRider)

  function sendMessage({ text, recipients, from }) {
    const base = Date.now()
    const createdAt = new Date().toLocaleString()
    const received = recipients.map((name, i) => ({
      id: base + i + Math.random(),
      type: 'message',
      rider: name,
      from,
      text,
      createdAt,
      read: false,
    }))
    const sentCopy = {
      id: base + recipients.length + Math.random(),
      type: 'sent_message',
      rider: from,
      from,
      text,
      recipients,
      createdAt,
      read: true,
    }
    setMessages(prev => [sentCopy, ...received, ...prev])
  }

  function markRead(id) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  }

  function deleteMessage(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  return (
    <CrewShell
      currentRider={currentRider}
      isAdmin={isAdmin}
      myNotifications={myNotifications}
      clearMyNotifications={() => setNotifications(prev => prev.filter(n => n.rider !== currentRider))}
      removeNotification={id => setNotifications(prev => prev.filter(n => n.id !== id))}
      addNotification={n => setNotifications(prev => [n, ...prev])}
      trips={trips}
      updateTrip={(id, patch) => setTrips(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))}
      addTrip={t => setTrips(prev => [t, ...prev])}
      posts={posts}
      addPost={p => setPosts(prev => [p, ...prev])}
      updatePost={(id, patch) => setPosts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))}
      removePost={id => setPosts(prev => prev.filter(p => p.id !== id))}
      challenges={challenges}
      addChallenge={c => setChallenges(prev => [c, ...prev])}
      updateChallenge={(id, patch) => setChallenges(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))}
      gear={gear}
      addGear={g => setGear(prev => [g, ...prev])}
      updateGear={(id, patch) => setGear(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g))}
      removeGear={id => setGear(prev => prev.filter(g => g.id !== id))}
      riders={riders}
      onUpdateRider={(id, patch) => setRiders(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))}
      listings={listings}
      addListing={l => setListings(prev => [l, ...prev])}
      updateListing={(id, patch) => setListings(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))}
      messages={messages.filter(m => m.rider === currentRider)}
      onSendMessage={sendMessage}
      onMarkRead={markRead}
      onDeleteMessage={deleteMessage}
      account={{
        mode: 'demo',
        riderNames: RIDER_NAMES,
        currentRider,
        onSelectRider: setCurrentRider,
        isAdmin,
        onToggleAdmin: () => setIsAdmin(v => !v),
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* LIVE MODE — Supabase-backed, shared across the crew                 */
/* ------------------------------------------------------------------ */
function LiveApp() {
  const { profile, isAdmin, signOut } = useAuth()
  const currentRider = profile.name

  const trips = useCollection('trips')
  const posts = useCollection('posts')
  const challenges = useCollection('challenges')
  const gear = useCollection('gear')
  const marketplace = useCollection('marketplace')
  const notifications = useCollection('notifications')
  const { riders, pending, updateRiderData, setStatus } = useProfiles()

  async function onRefresh() {
    await Promise.all([
      posts.refetch(),
      trips.refetch(),
      challenges.refetch(),
      gear.refetch(),
      notifications.refetch(),
    ])
  }

  async function addNotification(n) {
    await supabase.from('notifications').insert({ id: n.id, recipient_name: n.rider, data: n })
  }
  async function clearMyNotifications() {
    // Only delete system notifications, not inbox messages
    const toDelete = notifications.items
      .filter(n => n.rider === currentRider && n.type !== 'message')
      .map(n => n.id)
    if (toDelete.length) {
      await supabase.from('notifications').delete().in('id', toDelete)
      notifications.setItems(prev => prev.filter(x => !(x.rider === currentRider && x.type !== 'message')))
    }
  }

  async function sendMessage({ text, recipients, from }) {
    const base = Date.now()
    const createdAt = new Date().toLocaleString()
    const sentId = base + recipients.length + Math.random()
    const sentData = { type: 'sent_message', rider: from, from, text, recipients, createdAt, read: true }

    // Optimistic: show in Sent immediately without waiting for Supabase
    notifications.setItems(prev => [{ id: sentId, ...sentData }, ...prev])

    const receivedInserts = recipients.map((name, i) => {
      const id = base + i + Math.random()
      const data = { type: 'message', rider: name, from, text, createdAt, read: false }
      return supabase.from('notifications').insert({ id, recipient_name: name, data })
    })
    await Promise.all([
      ...receivedInserts,
      supabase.from('notifications').insert({ id: sentId, recipient_name: from, data: sentData }),
    ])
    // Sync to confirm server state
    notifications.refetch()
  }

  function markRead(id) {
    notifications.update(id, { read: true })
  }

  function deleteMessage(id) {
    notifications.remove(id)
  }

  const allMyNotifs = notifications.items.filter(n => n.rider === currentRider)
  const myNotifications = allMyNotifs.filter(n => n.type !== 'message' && n.type !== 'sent_message')
  const myMessages = allMyNotifs.filter(n => n.type === 'message' || n.type === 'sent_message')

  return (
    <CrewShell
      currentRider={currentRider}
      isAdmin={isAdmin}
      myNotifications={myNotifications}
      clearMyNotifications={clearMyNotifications}
      removeNotification={notifications.remove}
      addNotification={addNotification}
      trips={trips.items}
      updateTrip={trips.update}
      addTrip={trips.upsert}
      removeTrip={trips.remove}
      posts={posts.items}
      addPost={posts.upsert}
      updatePost={posts.update}
      removePost={posts.remove}
      challenges={challenges.items}
      addChallenge={challenges.upsert}
      updateChallenge={challenges.update}
      gear={gear.items}
      addGear={gear.upsert}
      updateGear={gear.update}
      removeGear={gear.remove}
      riders={riders}
      onUpdateRider={updateRiderData}
      listings={marketplace.items}
      addListing={marketplace.upsert}
      updateListing={marketplace.update}
      messages={myMessages}
      onSendMessage={sendMessage}
      onMarkRead={markRead}
      onDeleteMessage={deleteMessage}
      onRefresh={onRefresh}
      account={{
        mode: 'live',
        name: profile.name,
        email: profile.email,
        isAdmin,
        pending,
        onApprove: id => setStatus(id, 'approved'),
        onDecline: id => setStatus(id, 'declined'),
        onSignOut: signOut,
      }}
    />
  )
}
