import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import * as db from './db.js'
import { mergeSettings, payload, changedEntries } from '../lib/settingsSync.js'
import * as cloud from '../lib/cloud.js'
import { syncAttachments } from '../lib/files.js'
import { migrateCardPhotos } from '../lib/photoMigrate.js'
import { maybeSeed } from './seed.js'
import { collectSampleRemovals } from '../lib/sampleData.js'

const PHOTO_MIG_KEY = 'lulu:v1:photosMigratedToCloud'

const StoreCtx = createContext(null)
const SettingsCtx = createContext(null)

// The most recent soft-delete, so a "Deleted" toast anywhere can offer Undo.
// Deletes are soft (deletedAt), so restoring is just clearing that stamp.
const lastRemoved = { name: null, id: null }
const undoHandle = { restore: null }

// Restore whatever was deleted last. Safe to call from any toast action.
export function undoLastDelete() {
  if (undoHandle.restore && lastRemoved.name) undoHandle.restore(lastRemoved.name, lastRemoved.id)
  lastRemoved.name = null; lastRemoved.id = null
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(() => {
    // Seed sample data on first ever launch (idempotent) BEFORE the first read,
    // so the initial render already reflects it.
    maybeSeed()
    db.ensureAccounts()   // migrate legacy string accounts → account records
    const init = {}
    db.COLLECTIONS.forEach(c => { init[c] = db.readCollection(c) })
    return init
  })
  const [settings, setSettings] = useState(() => db.readSettings())

  const reload = useCallback((name) => {
    setData(prev => ({ ...prev, [name]: db.readCollection(name) }))
  }, [])

  const add = useCallback((name, fields) => {
    const rec = db.insert(name, fields)
    reload(name)
    cloud.pushRecord(name, rec)
    return rec
  }, [reload])

  const patch = useCallback((name, id, p) => {
    const rec = db.update(name, id, p)
    reload(name)
    cloud.pushRecord(name, rec)
    return rec
  }, [reload])

  const save = useCallback((name, rec) => {
    const out = db.upsert(name, rec)
    reload(name)
    cloud.pushRecord(name, out)
    return out
  }, [reload])

  const remove = useCallback((name, id) => {
    const rec = db.softDelete(name, id)
    lastRemoved.name = name; lastRemoved.id = id
    reload(name)
    cloud.pushRecord(name, rec)
  }, [reload])

  // Bring a soft-deleted record back (Undo). Pushes the restored row to cloud
  // sync too, so other devices see it reappear.
  const restore = useCallback((name, id) => {
    const rec = db.update(name, id, { deletedAt: null })
    if (!rec) return
    reload(name)
    cloud.pushRecord(name, rec)
  }, [reload])
  undoHandle.restore = restore

  // Personal settings (profile, budgets…) follow you to your other devices;
  // a change is uploaded shortly after it's made (see lib/settingsSync.js).
  const settingsPushT = useRef(null)
  const queueSettingsPush = useCallback(() => {
    clearTimeout(settingsPushT.current)
    settingsPushT.current = setTimeout(() => {
      const s = db.readSettings()
      if (s.settingsSyncedOnce) cloud.pushSettings(payload(s))
    }, 800)
  }, [])
  const updateSettings = useCallback((partial) => {
    // Stamp exactly the synced fields that really changed (screens may re-save
    // the same values on open; that must not count as a change).
    const cur = db.readSettings()
    const changed = changedEntries(cur, { ...cur, ...partial })
    setSettings(prev => {
      const next = { ...prev, ...partial }
      if (changed.length) {
        const now = new Date().toISOString()
        next.settingsStamps = { ...(prev.settingsStamps || {}) }
        changed.forEach(e => { next.settingsStamps[e] = now })
        next.settingsUpdatedAt = now
      }
      db.writeSettings(next)
      return next
    })
    if (changed.length) queueSettingsPush()
  }, [queueSettingsPush])

  // Pull this person's settings from the cloud and merge (first time: fill
  // empty fields only; after that the newer copy wins), uploading if ours is newer.
  const syncSettings = useCallback(async () => {
    if (!cloud.isReady()) return
    const remote = await cloud.pullSettings()
    if (remote === undefined) return // couldn't tell — try again next time
    const r = mergeSettings(db.readSettings(), remote)
    if (r.patch) {
      const next = { ...db.readSettings(), ...r.patch }
      db.writeSettings(next)
      setSettings(next)
    }
    if (r.push) await cloud.pushSettings(payload(db.readSettings()))
  }, [])

  const reloadAll = useCallback(() => {
    const all = {}
    db.COLLECTIONS.forEach(c => { all[c] = db.readCollection(c) })
    setData(all)
    setSettings(db.readSettings())
  }, [])

  // Full two-way cloud sync (push local, pull remote), then refresh state if
  // anything changed. Safe no-op when cloud isn't configured / signed in.
  const cloudSync = useCallback(async () => {
    if (!cloud.isReady()) return
    const changed = await cloud.syncNow()
    if (changed && changed.size) reloadAll()
    await syncSettings()
    // Mirror document/receipt binaries after the records they belong to.
    syncAttachments().catch(() => {})
  }, [reloadAll, syncSettings])

  // On launch: sync once, then poll for remote changes while the app is open.
  useEffect(() => {
    let alive = true
    cloudSync()
    const t = setInterval(() => {
      if (!cloud.isReady()) return
      cloud.pullAll().then(ch => { if (alive && ch && ch.size) reloadAll() })
      syncSettings()
    }, 20000)
    // Coming back to the app (e.g. after asking Claude to add something): sync
    // straight away instead of waiting for the next poll.
    const onVisible = () => { if (document.visibilityState === 'visible' && cloud.isReady()) cloudSync() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [cloudSync, reloadAll, syncSettings])

  // One-time move of legacy on-record photos (accessory / vehicle cover /
  // avatars) into the cloud bucket, freeing the localStorage budget. Runs only
  // when cloud is ready + consented; the ref guards against concurrent passes,
  // the flag against repeats. Safe/idempotent (see lib/photoMigrate.js).
  const migratingPhotos = useRef(false)
  const migratePhotos = useCallback(async () => {
    if (migratingPhotos.current || !cloud.storageReady()) return
    try { if (localStorage.getItem(PHOTO_MIG_KEY) === '1') return } catch { return }
    migratingPhotos.current = true
    try {
      const n = await migrateCardPhotos({ data, patch, settings, updateSettings })
      try { localStorage.setItem(PHOTO_MIG_KEY, '1') } catch { /* ignore */ }
      if (n) reloadAll()
    } finally { migratingPhotos.current = false }
  }, [data, patch, settings, updateSettings, reloadAll])
  useEffect(() => { migratePhotos() }, [migratePhotos])

  // Remove the built-in sample/seed records (soft-delete, which also clears
  // them from the cloud for connected users). Returns how many were removed.
  const removeSampleData = useCallback(() => {
    const removals = collectSampleRemovals(data)
    removals.forEach(({ collection, id }) => {
      const rec = db.softDelete(collection, id)
      cloud.pushRecord(collection, rec)
    })
    if (removals.length) reloadAll()
    return removals.length
  }, [data, reloadAll])

  const store = useMemo(() => ({ data, add, patch, save, remove, restore, reload, reloadAll, cloudSync, removeSampleData }), [data, add, patch, save, remove, restore, reload, reloadAll, cloudSync, removeSampleData])
  const settingsValue = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])

  return (
    <SettingsCtx.Provider value={settingsValue}>
      <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
    </SettingsCtx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// Convenience: a live array for one collection + helpers bound to it.
export function useCollection(name) {
  const { data, add, patch, save, remove } = useStore()
  return {
    items: data[name] || [],
    add: (fields) => add(name, fields),
    patch: (id, p) => patch(name, id, p),
    save: (rec) => save(name, rec),
    remove: (id) => remove(name, id),
  }
}

export function useSettings() {
  const ctx = useContext(SettingsCtx)
  if (!ctx) return { settings: db.DEFAULT_SETTINGS, updateSettings: () => {} }
  return ctx
}
