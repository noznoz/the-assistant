import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

// Loads rows from a `{ id, data, ... }` table and keeps them live via Realtime.
// Returns the rows flattened to `{ id, ...data }` (the shape the UI expects),
// plus helpers to upsert / remove rows that write straight to Supabase.
export function useCollection(table, { enabled = true, orderBy = 'id', ascending = false } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const flatten = row => ({ id: row.id, ...(row.data || {}) })

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
    if (!error && data) setItems(data.map(flatten))
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    refetch()
    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => refetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table, enabled, refetch])

  // Insert or replace a whole item. `item` is `{ id, ...fields }`.
  const upsert = useCallback(async (item) => {
    const { id, ...rest } = item
    const { data: auth } = await supabase.auth.getUser()
    setItems(prev => {                       // optimistic
      const exists = prev.some(i => i.id === id)
      return exists ? prev.map(i => i.id === id ? item : i) : [item, ...prev]
    })
    await supabase.from(table).upsert({
      id,
      data: rest,
      created_by: auth?.user?.id ?? null,
    })
  }, [table])

  // Patch fields on an existing item by id.
  const update = useCallback(async (id, patch) => {
    let next
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      next = { ...i, ...patch }
      return next
    }))
    if (next) {
      const { id: _omit, ...rest } = next
      await supabase.from(table).update({ data: rest }).eq('id', id)
    }
  }, [table])

  const remove = useCallback(async (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from(table).delete().eq('id', id)
  }, [table])

  return { items, setItems, loading, refetch, upsert, update, remove }
}
