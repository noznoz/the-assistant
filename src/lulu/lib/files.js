// Attachment helpers: save a picked/captured file, make a thumbnail, share
// real files via the OS share sheet (WhatsApp, Mail, …), download, and open.
import { putFile, getFile, deleteFile } from '../store/fileStore.js'
import { uid } from '../store/db.js'

// Downscale an image file to a small JPEG data URL for list/grid previews.
export function makeThumb(file, max = 260) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/')) { resolve(null); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      try { resolve(c.toDataURL('image/jpeg', 0.72)) } catch { resolve(null) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// Downscale a large image to a memory-safe size (longest edge <= max). Phone
// photos are ~12MP (~48MB decoded) which can crash mobile Safari when several
// are rendered; storing a ~2000px JPEG keeps documents legible and light.
export function downscaleImage(file, max = 2000, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif') { resolve(file); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const longest = Math.max(img.width, img.height)
      if (longest <= max) { URL.revokeObjectURL(url); resolve(file); return }
      const scale = max / longest
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      c.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        const named = new File([blob], (file.name || 'photo').replace(/\.(png|heic|heif|webp)$/i, '') + '.jpg', { type: 'image/jpeg' })
        resolve(named)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Downscale an image file to a self-contained JPEG data URL. Used for avatars
// and vehicle photos that live directly on a record (localStorage) rather than
// as a separate IndexedDB attachment — small enough to store, sharp enough to
// fill a card or profile header. Returns '' for non-images or on failure.
export function imageToDataURL(file, max = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) { resolve(''); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      try { resolve(c.toDataURL('image/jpeg', quality)) } catch { resolve('') }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
    img.src = url
  })
}

// Persist a File to IndexedDB and return its metadata record.
export async function saveAttachment(rawFile) {
  const file = await downscaleImage(rawFile)
  const id = uid()
  await putFile(id, file)
  const thumb = await makeThumb(file)
  return {
    id,
    name: file.name || `document-${new Date().toISOString().slice(0, 10)}`,
    type: file.type || 'application/octet-stream',
    size: file.size || 0,
    thumb,
    addedAt: new Date().toISOString(),
  }
}

export async function getAttachmentFile(att) {
  const blob = await getFile(att.id)
  if (!blob) return null
  return new File([blob], att.name || 'document', { type: att.type || blob.type || 'application/octet-stream' })
}

export async function removeAttachment(att) {
  try { await deleteFile(att.id) } catch { /* best effort */ }
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name || 'document'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// Share real files via the native share sheet. Returns a status string:
// 'shared' | 'cancelled' | 'downloaded' | 'empty'. The OS sheet is what
// exposes WhatsApp, Mail, Messages, etc. Desktop falls back to download.
export async function shareAttachments(atts, text = '') {
  const files = []
  for (const a of atts) {
    const f = await getAttachmentFile(a)
    if (f) files.push(f)
  }
  if (!files.length) return 'empty'
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, text }); return 'shared' }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled' }
  }
  files.forEach(f => downloadBlob(f, f.name))
  return 'downloaded'
}

export function isImage(att) { return att && att.type && att.type.startsWith('image/') }
export function isPdf(att) { return att && att.type === 'application/pdf' }

export function humanSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
