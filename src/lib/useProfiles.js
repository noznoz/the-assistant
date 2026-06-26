import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

const CURRENT_YEAR = new Date().getFullYear()

// Map a raw profiles row into the rider shape the Riders tab expects.
export function toRider(p) {
  const d = p.data || {}
  const joinDate = new Date(p.created_at)
  const joinedLabel = `Joined ${joinDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return {
    id: p.id,
    name: p.name,
    handle: d.handle || '@' + (p.name || 'rider').toLowerCase().replace(/\s+/g, '_'),
    avatar: d.avatar || '🤘',
    photo: d.photo || null,
    album: d.album || [],
    garage: d.garage || [],
    helmets: d.helmets || [],
    bike: d.bike || '—',
    miles: d.miles ?? 0,
    joinedAt: p.created_at,          // raw timestamp (set automatically at signup)
    joined: d.joined || joinedLabel, // human label, e.g. "Joined Jun 26, 2026"
    role: d.role || 'Member',
    tags: d.tags || [],
    bio: d.bio || 'New to the crew.',
    location: d.location || '—',
    ridingSince: d.ridingSince ?? CURRENT_YEAR,
    favoriteRoad: d.favoriteRoad || '—',
    bloodType: d.bloodType || '—',
    emergency: d.emergency || { name: '—', phone: '—' },
    gear: d.gear || { helmet: '—', jacket: '—' },
    _accountRole: p.role,   // auth role: member | admin
    _status: p.status,
  }
}

export function useProfiles({ enabled = true } = {}) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: true })
    if (!error && data) setProfiles(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    refetch()
    const channel = supabase
      .channel('realtime:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [enabled, refetch])

  // Merge a patch of rider fields into a profile's `data` jsonb.
  const updateRiderData = useCallback(async (id, patch) => {
    const row = profiles.find(p => p.id === id)
    const nextData = { ...(row?.data || {}), ...patch }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, data: nextData } : p))
    await supabase.from('profiles').update({ data: nextData }).eq('id', id)
  }, [profiles])

  const setStatus = useCallback(async (id, status) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    await supabase.from('profiles').update({ status }).eq('id', id)
  }, [])

  const approved = profiles.filter(p => p.status === 'approved')
  const pending = profiles.filter(p => p.status === 'pending')
  const riders = approved.map(toRider)

  return { profiles, riders, pending, loading, updateRiderData, setStatus, refetch }
}
