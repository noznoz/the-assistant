import { supabase } from './supabase.js'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  // Skip decode+re-encode for already-small files — avoid pointless CPU work
  if (file.size < 600_000) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    // Guard against zero-dimension bitmaps (malformed files) — would produce corrupt 0×0 JPEG
    if (!width || !height) { bitmap.close(); return file }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    // Guard against null context (GPU memory pressure on low-end devices)
    if (!ctx) { bitmap.close(); canvas.width = 0; return file }

    // White fill before drawing — transparent PNG pixels composite against the
    // canvas default (transparent black), which JPEG bakes in as black patches.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    canvas.width = 0 // release backing pixel buffer immediately

    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg') || 'photo.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

// Upload a File to the public 'media' bucket and return its public URL.
// Falls back to a local object URL if Supabase isn't configured (demo mode).
export async function uploadImage(file, folder = 'misc') {
  if (!file) return null
  const upload = await compressImage(file)
  try {
    const ext = (upload.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, upload, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.warn('Image upload failed, using local preview:', e?.message)
    return URL.createObjectURL(upload)
  }
}
