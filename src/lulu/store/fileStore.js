// IndexedDB blob storage for document attachments (photos & PDFs).
// localStorage is too small for images, so binaries live here; the document
// records in db.js keep only lightweight metadata + a thumbnail.

const DB_NAME = 'lulu-files'
const STORE = 'files'
let _dbPromise

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

async function run(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function putFile(id, blob) { return run('readwrite', s => s.put(blob, id)) }
export function getFile(id) { return run('readonly', s => s.get(id)) }
export function deleteFile(id) { return run('readwrite', s => s.delete(id)) }
