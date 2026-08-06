import { beforeEach, describe, expect, test } from 'vitest'
import * as db from './db.js'

beforeEach(() => localStorage.clear())

describe('local CRUD', () => {
  test('insert / read / update / soft-delete', () => {
    const rec = db.insert('tasks', { title: 'A' })
    expect(rec.id).toBeTruthy()
    expect(rec.createdAt).toBeTruthy()
    expect(db.readCollection('tasks')).toHaveLength(1)

    db.update('tasks', rec.id, { title: 'B' })
    expect(db.readCollection('tasks')[0].title).toBe('B')

    db.softDelete('tasks', rec.id)
    expect(db.readCollection('tasks')).toHaveLength(0) // hidden from reads
  })

  test('upsert inserts new, updates existing by id', () => {
    const a = db.insert('notes', { text: 'one' })
    const same = db.upsert('notes', { id: a.id, text: 'edited' })
    expect(same.id).toBe(a.id)
    expect(db.readCollection('notes')).toHaveLength(1)
    expect(db.readCollection('notes')[0].text).toBe('edited')
    db.upsert('notes', { id: 'brand-new', text: 'two' })
    expect(db.readCollection('notes')).toHaveLength(2)
  })
})

describe('mergeRemote — last-write-wins by updatedAt', () => {
  test('older remote is ignored, newer remote wins', () => {
    const rec = db.insert('tasks', { title: 'local' })
    db.mergeRemote({ tasks: [{ ...rec, title: 'older', updatedAt: '2000-01-01T00:00:00.000Z' }] })
    expect(db.readCollection('tasks')[0].title).toBe('local')

    const changed = db.mergeRemote({ tasks: [{ ...rec, title: 'newer', updatedAt: '2999-01-01T00:00:00.000Z' }] })
    expect(changed.has('tasks')).toBe(true)
    expect(db.readCollection('tasks')[0].title).toBe('newer')
  })

  test('a remote soft-delete propagates', () => {
    const rec = db.insert('tasks', { title: 'x' })
    db.mergeRemote({ tasks: [{ ...rec, deletedAt: '2999-01-01T00:00:00.000Z', updatedAt: '2999-01-01T00:00:00.000Z' }] })
    expect(db.readCollection('tasks')).toHaveLength(0)
  })

  test('unknown collections and non-arrays are skipped safely', () => {
    const changed = db.mergeRemote({ not_a_collection: [{ id: '1' }], tasks: 'nope' })
    expect(changed.size).toBe(0)
  })
})

describe('quota-safe writes', () => {
  test('writeCollection returns false and fires lulu:storage-full when the disk is full', () => {
    const orig = Storage.prototype.setItem
    let fired = false
    const onFull = () => { fired = true }
    window.addEventListener('lulu:storage-full', onFull)
    Storage.prototype.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e }
    try {
      const ok = db.writeCollection('tasks', [{ id: '1' }])
      expect(ok).toBe(false)
    } finally {
      Storage.prototype.setItem = orig
      window.removeEventListener('lulu:storage-full', onFull)
    }
    expect(fired).toBe(true)
  })
})
