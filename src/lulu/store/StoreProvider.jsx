import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import * as db from './db.js'
import { maybeSeed } from './seed.js'

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
    return rec
  }, [reload])

  const patch = useCallback((name, id, p) => {
    const rec = db.update(name, id, p)
    reload(name)
    return rec
  }, [reload])

  const save = useCallback((name, rec) => {
    const out = db.upsert(name, rec)
    reload(name)
    return out
  }, [reload])

  const remove = useCallback((name, id) => {
    db.softDelete(name, id)
    reload(name)
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

  const store = useMemo(() => ({ data, add, patch, save, remove, reload, reloadAll }), [data, add, patch, save, remove, reload, reloadAll])
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
