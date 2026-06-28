import { useState } from 'react'
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

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <span style={{ fontSize: 38 }}>🏍️</span>
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
  const [notifications, setNotifications] = useState([])
  const [messages, setMessages] = useState([])

  const myNotifications = notifications.filter(n => n.rider === currentRider)

  function sendMessage({ text, recipients, from }) {
    const batch = recipients.map(name => ({
      id: `msg-${Date.now()}-${name}`,
      type: 'message',
      rider: name,
      from,
      text,
      createdAt: new Date().toLocaleString(),
      read: false,
    }))
    setMessages(prev => [...batch, ...prev])
  }

  function markRead(id) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  }

  return (
    <CrewShell
      currentRider={currentRider}
      isAdmin={isAdmin}
      myNotifications={myNotifications}
      clearMyNotifications={() => setNotifications(prev => prev.filter(n => n.rider !== currentRider))}
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
      messages={messages}
      onSendMessage={sendMessage}
      onMarkRead={markRead}
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
    await Promise.all(recipients.map(name => {
      const id = `msg-${Date.now()}-${name}-${Math.random().toString(36).slice(2, 7)}`
      const data = { id, type: 'message', rider: name, from, text, createdAt: new Date().toLocaleString(), read: false }
      return supabase.from('notifications').insert({ id, recipient_name: name, data })
    }))
  }

  function markRead(id) {
    notifications.update(id, { read: true })
  }

  const allMyNotifs = notifications.items.filter(n => n.rider === currentRider)
  const myNotifications = allMyNotifs.filter(n => n.type !== 'message')
  const myMessages = allMyNotifs.filter(n => n.type === 'message')

  return (
    <CrewShell
      currentRider={currentRider}
      isAdmin={isAdmin}
      myNotifications={myNotifications}
      clearMyNotifications={clearMyNotifications}
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
      messages={myMessages}
      onSendMessage={sendMessage}
      onMarkRead={markRead}
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
