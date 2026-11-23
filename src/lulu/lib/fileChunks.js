// Files carried through the records table, for projects without the storage
// bucket (no setup needed). A file is base64-encoded and split into pieces of
// at most CHUNK characters, each its own record 'file:<id>:<n>' in the
// '_files' collection, so every request stays small. Pure helpers here; the
// network calls are in lib/cloud.js.
export const FILE_COLLECTION = '_files'
export const CHUNK = 400 * 1024 // characters of base64 per record (~300 KB of file)

export const chunkId = (fileId, i) => `file:${fileId}:${i}`

export function splitBase64(fileId, type, b64) {
  const n = Math.max(1, Math.ceil(b64.length / CHUNK))
  return Array.from({ length: n }, (_, i) => ({ id: chunkId(fileId, i), data: { fileId, i, n, type, b: b64.slice(i * CHUNK, (i + 1) * CHUNK) } }))
}

// rows: [{ data: { i, n, type, b } }] in any order. Returns { type, b64 } or null
// when pieces are missing (e.g. an upload that's still in progress).
export function joinBase64(rows) {
  const parts = (rows || []).map(r => r && r.data).filter(Boolean)
  if (!parts.length) return null
  const n = parts[0].n
  if (!n || parts.length < n) return null
  const byI = new Map(parts.map(p => [p.i, p]))
  let b64 = ''
  for (let i = 0; i < n; i++) { const p = byI.get(i); if (!p) return null; b64 += p.b }
  return { type: parts[0].type || 'application/octet-stream', b64 }
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => { const s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)) }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
export function base64ToBlob(b64, type) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}
