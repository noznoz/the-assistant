import { useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import Feed from './tabs/Feed.jsx'
import Trips from './tabs/Trips.jsx'
import Gear from './tabs/Gear.jsx'
import Riders from './tabs/Riders.jsx'
import Challenges from './tabs/Challenges.jsx'

// The shared app UI. Works for both demo (in-memory) and live (Supabase) modes;
// the only difference is the `account` descriptor and where the data comes from.
export default function CrewShell({
  currentRider, isAdmin,
  myNotifications, clearMyNotifications, addNotification,
  trips, updateTrip, addTrip,
  posts, addPost, updatePost, removePost,
  challenges, addChallenge, updateChallenge,
  gear, addGear, updateGear, removeGear,
  riders, onUpdateRider,
  account,
}) {
  const [tab, setTab] = useState('feed')

  // The current rider's owned bikes — offered as ride-bike choices in Trips.
  const me = riders.find(r => r.name === currentRider)
  const myBikes = (me?.garage || [])
    .filter(b => (b.status || 'owned') !== 'sold')
    .map(b => `${b.year} ${b.make} ${b.model}`.trim())
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  function closeAll() {
    if (showMenu) setShowMenu(false)
    if (showNotifications) setShowNotifications(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top))',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'relative',
      }}>
        <img src="/icon-192.png" alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1, color: 'var(--orange)' }}>ROAD HEAVEN</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--orange)', color: '#fff', padding: '2px 8px', borderRadius: 6, letterSpacing: 1 }}>ADMIN</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowNotifications(v => !v); setShowMenu(false) }}
            style={{ position: 'relative', fontSize: 18, padding: '2px 6px', color: myNotifications.length ? 'var(--gold)' : 'var(--text-muted)' }}
            title="Notifications"
          >
            🔔
            {myNotifications.length > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2, background: 'var(--orange)', color: '#fff',
                fontSize: 9, fontWeight: 700, borderRadius: '50%', minWidth: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px',
              }}>{myNotifications.length > 9 ? '9+' : myNotifications.length}</span>
            )}
          </button>
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(v => !v); setShowNotifications(false) }}
            style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}
          >
            {currentRider.split(' ')[0]} ▾
          </button>
        </div>

        {/* Notifications dropdown */}
        {showNotifications && (
          <div style={dropdown}>
            <div style={dropdownHead}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
              {myNotifications.length > 0 && (
                <button onClick={clearMyNotifications} style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clear all</button>
              )}
            </div>
            {myNotifications.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No notifications yet</div>
            ) : myNotifications.map(n => (
              <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>💬</span>
                <div>
                  <p style={{ fontSize: 13, lineHeight: 1.4 }}>{n.text}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Account menu (mode-specific) */}
        {showMenu && (
          <div style={dropdown}>
            {account.mode === 'demo' ? (
              <DemoMenu account={account} onClose={() => setShowMenu(false)} />
            ) : (
              <LiveMenu account={account} onClose={() => setShowMenu(false)} />
            )}
          </div>
        )}
      </header>

      {account.mode === 'demo' && (
        <div style={{
          background: '#1a1500', borderBottom: '1px solid #2a2000',
          padding: '6px 16px', fontSize: 11, color: 'var(--gold)', textAlign: 'center', flexShrink: 0,
        }}>
          Demo mode — data isn't saved or shared. Add Supabase keys to go live.
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }} onClick={closeAll}>
        {tab === 'feed' && (
          <Feed
            currentRider={currentRider} isAdmin={isAdmin} addNotification={addNotification}
            posts={posts} addPost={addPost} updatePost={updatePost} removePost={removePost}
          />
        )}
        {tab === 'trips' && (
          <Trips
            trips={trips} updateTrip={updateTrip} addTrip={addTrip}
            currentRider={currentRider} isAdmin={isAdmin} addNotification={addNotification}
            myBikes={myBikes}
          />
        )}
        {tab === 'challenges' && (
          <Challenges
            currentRider={currentRider} isAdmin={isAdmin} addNotification={addNotification}
            challenges={challenges} addChallenge={addChallenge} updateChallenge={updateChallenge}
            roster={riders}
          />
        )}
        {tab === 'gear' && (
          <Gear
            gear={gear} addGear={addGear} updateGear={updateGear} removeGear={removeGear}
            currentRider={currentRider} isAdmin={isAdmin} roster={riders} addNotification={addNotification}
          />
        )}
        {tab === 'riders' && (
          <Riders
            riders={riders} onUpdateRider={onUpdateRider}
            trips={trips} posts={posts} challenges={challenges}
            currentRider={currentRider} isAdmin={isAdmin}
            onNavigateToFeed={() => setTab('feed')} onNavigateToChallenges={() => setTab('challenges')}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

function DemoMenu({ account, onClose }) {
  const { riderNames, currentRider, onSelectRider, isAdmin, onToggleAdmin } = account
  return (
    <>
      {riderNames.map(name => (
        <button
          key={name}
          onClick={() => { onSelectRider(name); onClose() }}
          style={{
            width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13,
            color: name === currentRider ? 'var(--orange)' : 'var(--text)',
            fontWeight: name === currentRider ? 700 : 400,
            borderBottom: '1px solid var(--border)',
          }}
        >{name}</button>
      ))}
      <button
        onClick={() => { onToggleAdmin(); onClose() }}
        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: isAdmin ? 'var(--orange)' : 'var(--text-muted)', fontWeight: 600 }}
      >{isAdmin ? '✓ Admin mode on' : 'Switch to Admin'}</button>
    </>
  )
}

function LiveMenu({ account, onClose }) {
  const { name, email, isAdmin, pending = [], onApprove, onDecline, onSignOut } = account
  return (
    <>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13, fontWeight: 700 }}>{name}</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{email}</p>
      </div>
      {isAdmin && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, padding: '10px 14px 4px' }}>
            PENDING APPROVALS ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 14px 12px' }}>No one waiting.</p>
          ) : pending.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onApprove(p.id)} style={{ fontSize: 11, fontWeight: 700, color: '#4caf50', border: '1px solid #4caf50', borderRadius: 6, padding: '3px 8px' }}>Approve</button>
                <button onClick={() => onDecline(p.id)} style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => { onClose(); onSignOut() }} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', fontSize: 13, color: 'var(--text)' }}>
        Sign out
      </button>
    </>
  )
}

const dropdown = {
  position: 'absolute', top: '100%', right: 12, zIndex: 50,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 10, minWidth: 200, maxWidth: 320,
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxHeight: 380, overflowY: 'auto',
}
const dropdownHead = {
  padding: '10px 14px', borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
