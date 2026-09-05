// ============================================================================
// One-time migration of legacy "card" photos (accessory / vehicle cover /
// avatars) that were stored as full base64 data-URIs directly on the record —
// which fills the small localStorage budget. Each is uploaded to the household
// cloud bucket and replaced on the record with a tiny thumbnail + a photoId.
//
// SAFETY: a photo is only down-rezzed after its cloud copy is confirmed
// *retrievable* (upload + read-back). If anything fails, the record is left
// exactly as it was. Idempotent — records already carrying a photoId, or whose
// photo isn't a data-URI, are skipped.
// ============================================================================
import { uid } from '../store/db.js'
import * as cloud from './cloud.js'

// Collection → the record field that holds its on-record image (most use
// `photo`; wishlist uses `image`).
const PHOTO_FIELDS = {
  accessories: 'photo', vehicles: 'photo', people: 'photo',
  staff: 'photo', properties: 'photo', wishlist: 'image',
}

const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:')

// Shrink a data-URL to a smaller data-URL for on-record display.
function shrinkDataUrl(dataUrl, max = 256, q = 0.7) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      try { resolve(c.toDataURL('image/jpeg', q)) } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

async function dataUrlToBlob(dataUrl) {
  try { const r = await fetch(dataUrl); return await r.blob() } catch { return null }
}

// Migrate one data-URL → { photo (thumb), photoId } or null if it couldn't be
// safely moved (leave the record untouched in that case).
export async function migrateOnePhoto(dataUrl) {
  if (!isDataUrl(dataUrl) || !cloud.storageReady()) return null
  const blob = await dataUrlToBlob(dataUrl)
  if (!blob) return null
  const id = uid()
  const ok = await cloud.uploadFile(id, blob)
  if (!ok) return null
  // Confirm the cloud object is actually readable before shrinking the local copy.
  const check = await cloud.downloadFile(id)
  if (!check) return null
  cloud.markUploaded(id)
  const thumb = await shrinkDataUrl(dataUrl, 256, 0.7)
  return { photo: thumb, photoId: id }
}

// Walk the photo-bearing collections + the owner profile, moving each legacy
// photo to the cloud. Returns how many were migrated.
export async function migrateCardPhotos({ data, patch, settings, updateSettings }) {
  if (!cloud.storageReady()) return 0
  let migrated = 0
  for (const [coll, field] of Object.entries(PHOTO_FIELDS)) {
    for (const rec of (data[coll] || [])) {
      if (!rec || rec.photoId || !isDataUrl(rec[field])) continue
      // eslint-disable-next-line no-await-in-loop
      const out = await migrateOnePhoto(rec[field])
      if (out) { patch(coll, rec.id, { [field]: out.photo, photoId: out.photoId }); migrated++ }
    }
  }
  const pf = (settings && settings.profile) || {}
  if (isDataUrl(pf.photo) && !pf.photoId) {
    const out = await migrateOnePhoto(pf.photo)
    if (out) { updateSettings({ profile: { ...pf, photo: out.photo, photoId: out.photoId } }); migrated++ }
  }
  return migrated
}
