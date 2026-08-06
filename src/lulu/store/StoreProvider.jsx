import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import * as db from './db.js'
import * as cloud from '../lib/cloud.js'
import { maybeSeed } from './seed.js'
import { collectSampleRemovals } from '../lib/sampleData.js'

const StoreCtx = createContext(null)
const SettingsCtx = createContext(null)

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
    reload(name)
    cloud.pushRecord(name, rec)
  }, [reload])

  const updateSettings = useCallback((partial) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      db.writeSettings(next)
      return next
    })
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
  }, [reloadAll])

  // On launch: sync once, then poll for remote changes while the app is open.
  useEffect(() => {
    let alive = true
    cloudSync()
    const t = setInterval(() => {
      if (!cloud.isReady()) return
      cloud.pullAll().then(ch => { if (alive && ch && ch.size) reloadAll() })
    }, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [cloudSync, reloadAll])

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

  const store = useMemo(() => ({ data, add, patch, save, remove, reload, reloadAll, cloudSync, removeSampleData }), [data, add, patch, save, remove, reload, reloadAll, cloudSync, removeSampleData])
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
