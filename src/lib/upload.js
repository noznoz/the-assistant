import { supabase } from './supabase.js'

// Upload a File to the public 'media' bucket and return its public URL.
// Falls back to a local object URL if Supabase isn't configured (demo mode).
export async function uploadImage(file, folder = 'misc') {
  if (!file) return null
  try {
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.warn('Image upload failed, using local preview:', e.message)
    return URL.createObjectURL(file)
  }
}
