import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured } from './supabase.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isConfigured)
  const [profileLoading, setProfileLoading] = useState(isConfigured)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setProfileLoading(false); return }
    setProfileLoading(true)
    try {
      // Retry transient failures — a cold PWA launch on mobile often has the
      // radio still waking up, and a single failed fetch here must NOT bounce
      // an approved user to the pending screen.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (data) { setProfile(data); return }
        // PGRST116 = no row exists: this user genuinely has no profile yet.
        if (error?.code === 'PGRST116') { setProfile(null); return }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
      // All retries failed (offline / network error): keep whatever profile we
      // already have instead of clobbering it with null.
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }

    // If getSession + profile load takes longer than 6s (offline / slow network),
    // unblock the UI so the app doesn't hang on the splash screen forever.
    const bail = setTimeout(() => setLoading(false), 6000)

    supabase.auth.getSession().then(async ({ data }) => {
      clearTimeout(bail)
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      await loadProfile(sess?.user?.id)
    })
    return () => { clearTimeout(bail); sub.subscription.unsubscribe() }
  }, [loadProfile])

  // Keep this user's profile live (status flips from pending → approved, etc.)
  useEffect(() => {
    if (!isConfigured || !session?.user?.id) return
    const channel = supabase
      .channel('realtime:my-profile')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        payload => setProfile(payload.new))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

  const signUp = useCallback(async ({ email, password, name }) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    return { error }
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const redeemInvite = useCallback(async (code) => {
    const { data, error } = await supabase.rpc('redeem_invite', { p_code: code })
    if (!error && data) await loadProfile(session?.user?.id)
    return { ok: !!data, error }
  }, [session?.user?.id, loadProfile])

  const refreshProfile = useCallback(
    () => loadProfile(session?.user?.id),
    [session?.user?.id, loadProfile])

  const value = {
    isConfigured,
    loading,
    profileLoading,
    session,
    user: session?.user ?? null,
    profile,
    isApproved: profile?.status === 'approved',
    isAdmin: profile?.role === 'admin',
    signUp, signIn, signInWithGoogle, signOut, redeemInvite, refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
