// Attachment helpers: save a picked/captured file, make a thumbnail, share
// real files via the OS share sheet (WhatsApp, Mail, …), download, and open.
import { putFile, getFile, deleteFile, listFileIds } from '../store/fileStore.js'
import { uid } from '../store/db.js'
import * as cloud from './cloud.js'

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

// Persist a File to IndexedDB and return its metadata record. When cloud sync is
// on, the binary is also mirrored to the household's private bucket (best-effort;
// syncAttachments() re-tries anything that fails here, e.g. while offline).
export async function saveAttachment(rawFile) {
  const file = await downscaleImage(rawFile)
  const id = uid()
  await putFile(id, file)
  const thumb = await makeThumb(file)
  if (cloud.storageReady()) cloud.uploadFile(id, file).then(ok => { if (ok) cloud.markUploaded(id) })
  return {
    id,
    name: file.name || `document-${new Date().toISOString().slice(0, 10)}`,
    type: file.type || 'application/octet-stream',
    size: file.size || 0,
    thumb,
    addedAt: new Date().toISOString(),
  }
}

// Get the real file for an attachment. Falls back to the cloud bucket when the
// blob isn't on this device yet (e.g. a document synced from another device),
// caching it locally so later opens are instant.
export async function getAttachmentFile(att) {
  let blob = await getFile(att.id)
  if (!blob && cloud.storageReady()) {
    blob = await cloud.downloadFile(att.id)
    if (blob) { try { await putFile(att.id, blob) } catch { /* cache best-effort */ } cloud.markUploaded(att.id) }
  }
  if (!blob) return null
  return new File([blob], att.name || 'document', { type: att.type || blob.type || 'application/octet-stream' })
}

export async function removeAttachment(att) {
  try { await deleteFile(att.id) } catch { /* best effort */ }
  try { cloud.deleteFileRemote(att.id) } catch { /* best effort */ }
}

// ---- Cloud-backed "card" photos (accessory / vehicle cover / avatars) ----
// These used to be stored as a full base64 data-URI directly on the record,
// which fills the tiny localStorage budget. Instead we keep only a small
// thumbnail on the record (for instant, offline display) and put the full image
// in the household cloud bucket. Returns { photo, photoId } to spread onto the
// record. When the cloud isn't available the full image is stashed in IndexedDB
// and uploaded on the next sync — so the heavy image never lands in localStorage.
export async function saveCloudPhoto(rawFile, { thumbMax = 256, fullMax = 1600, quality = 0.82 } = {}) {
  const thumb = await imageToDataURL(rawFile, thumbMax, 0.7)
  if (!thumb) return { photo: '', photoId: '' }
  const id = uid()
  const full = await downscaleImage(rawFile, fullMax, quality)
  if (cloud.storageReady()) {
    const ok = await cloud.uploadFile(id, full)
    if (ok) { cloud.markUploaded(id); return { photo: thumb, photoId: id } }
  }
  // Offline / cloud off / upload failed → keep the full locally; syncAttachments
  // uploads it later. The record still only carries the small thumbnail.
  try { await putFile(id, full) } catch { /* ignore */ }
  return { photo: thumb, photoId: id }
}

// Full-resolution URL for a cloud photo (share / enlarge). Prefers a local
// cache, else the cloud. Returns '' when unavailable. Caller revokes the URL.
export async function cloudPhotoURL(photoId) {
  if (!photoId) return ''
  let blob = null
  try { blob = await getFile(photoId) } catch { /* ignore */ }
  if (!blob && cloud.storageReady()) blob = await cloud.downloadFile(photoId)
  return blob ? URL.createObjectURL(blob) : ''
}

// Reconcile pass: upload any locally-stored attachment the current household's
// bucket doesn't have yet. Called after a record sync so files follow their
// metadata across devices. No-op when cloud/consent is off.
export async function syncAttachments() {
  if (!cloud.storageReady()) return
  const ids = await listFileIds()
  for (const id of ids) {
    if (cloud.isUploaded(id)) continue
    // eslint-disable-next-line no-await-in-loop
    const blob = await getFile(id)
    if (!blob) continue
    // eslint-disable-next-line no-await-in-loop
    const ok = await cloud.uploadFile(id, blob)
    if (ok) cloud.markUploaded(id)
  }
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
