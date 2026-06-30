import { supabase } from './supabase.js'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

// Downscale + re-encode a photo client-side before it ever hits the network.
// Camera photos can be 3-5MB+ at full resolution — way more than any UI
// thumbnail needs — so this keeps uploads fast and list/gallery scrolling smooth.
// Falls back to the original file if anything about the resize fails.
async function compressImage(file) {
  if (!file.type?.startsWith('image/') || file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 600_000) {
      bitmap.close?.()
      return file // already small enough, skip re-encoding
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name?.replace(/\.\w+$/, '.jpg') || 'photo.jpg', { type: 'image/jpeg' })
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
    const ext = (upload.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, upload, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.warn('Image upload failed, using local preview:', e.message)
    return URL.createObjectURL(upload)
  }
}
