import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// True only when real credentials are present (not the placeholders).
export const isConfigured =
  !!url && !!anonKey &&
  url !== 'YOUR_SUPABASE_URL_HERE' &&
  anonKey !== 'YOUR_SUPABASE_ANON_KEY_HERE'

// When unconfigured we still export a (dummy) client so imports don't crash;
// the app routes to the SetupScreen before any call is made.
export const supabase = isConfigured
  ? createClient(url, anonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key')
