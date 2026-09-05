import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as cloud from './cloud.js'

const CFG = 'lulu:v1:cloud:config'
const SES = 'lulu:v1:cloud:session'
const CONSENT = 'lulu:v1:cloud:consent'

function connect(householdId = 'hid-123') {
  localStorage.setItem(CFG, JSON.stringify({ url: 'https://proj.supabase.co', anonKey: 'anon' }))
  localStorage.setItem(SES, JSON.stringify({
    access_token: 'tok', refresh_token: 'r', user: { id: 'u1', email: 'a@b.c' }, householdId,
  }))
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('attachment storage — consent gate', () => {
  test('storageReady requires config + session + consent', () => {
    expect(cloud.storageReady()).toBe(false)
    connect()
    expect(cloud.storageReady()).toBe(false)      // signed in but not consented
    localStorage.setItem(CONSENT, '1')
    expect(cloud.storageReady()).toBe(true)
  })

  test('uploadFile uploads nothing without consent', async () => {
    connect()
    global.fetch = vi.fn()
    const ok = await cloud.uploadFile('a1', new Blob(['x']))
    expect(ok).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('attachment storage — transport', () => {
  beforeEach(() => { connect(); localStorage.setItem(CONSENT, '1') })

  test('uploadFile POSTs to the household-scoped path and remembers it', async () => {
    global.fetch = vi.fn(async () => ({ ok: true }))
    const ok = await cloud.uploadFile('att9', new Blob(['data'], { type: 'image/png' }))
    expect(ok).toBe(true)
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe('https://proj.supabase.co/storage/v1/object/attachments/hid-123/att9')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer tok')
    expect(opts.headers['x-upsert']).toBe('true')
  })

  test('downloadFile GETs the authenticated path and returns the blob', async () => {
    const blob = new Blob(['hi'])
    global.fetch = vi.fn(async () => ({ ok: true, blob: async () => blob }))
    const out = await cloud.downloadFile('att9')
    expect(out).toBe(blob)
    expect(global.fetch.mock.calls[0][0]).toContain('/storage/v1/object/authenticated/attachments/hid-123/att9')
  })

  test('the uploaded memo resets when the household changes', () => {
    cloud.markUploaded('x')
    expect(cloud.isUploaded('x')).toBe(true)
    connect('other-household')          // different bucket namespace
    expect(cloud.isUploaded('x')).toBe(false)
  })
})

describe('family roles + member data scoping', () => {
  const connectAs = (role, householdId = 'hid-1') => {
    localStorage.setItem(CFG, JSON.stringify({ url: 'https://proj.supabase.co', anonKey: 'anon' }))
    localStorage.setItem(SES, JSON.stringify({ access_token: 'tok', refresh_token: 'r', user: { id: 'u1', email: 'a@b.c' }, householdId, role }))
    localStorage.setItem(CONSENT, '1')
  }

  test('isOwner / isMember reflect the session role', () => {
    connectAs('owner'); expect(cloud.isOwner()).toBe(true); expect(cloud.isMember()).toBe(false)
    connectAs('member'); expect(cloud.isMember()).toBe(true); expect(cloud.isOwner()).toBe(false)
  })

  test('a member never pushes collections outside their scope', async () => {
    connectAs('member')
    global.fetch = vi.fn(async () => ({ ok: true }))
    await cloud.pushRecord('expenses', { id: 'e1', updatedAt: '2020-01-01' })
    expect(global.fetch).not.toHaveBeenCalled()          // finance stays off the member's device
    await cloud.pushRecord('tasks', { id: 't1', updatedAt: '2020-01-01' })
    expect(global.fetch).toHaveBeenCalledTimes(1)         // their tasks do sync
  })

  test('a member only pulls their own profile + assigned tasks', async () => {
    connectAs('member')
    const calls = []
    global.fetch = vi.fn(async (url) => { calls.push(url); return { ok: true, json: async () => [] } })
    await cloud.pullAll()
    const urls = calls.join(' | ')
    expect(urls).toContain('collection=eq.people')
    expect(urls).toContain('data->>userId=eq.u1')          // only their own profile record
    expect(urls).toContain('collection=eq.tasks')
    expect(urls).toContain('data->>assigneeUserId=eq.u1')  // only tasks assigned to them
  })

  test('the owner pulls everything (no scope filter)', async () => {
    connectAs('owner')
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }))
    await cloud.pullAll()
    expect(global.fetch.mock.calls[0][0]).not.toContain('collection=eq')
  })

  test('inviteLink targets the join route with the household id', () => {
    connectAs('owner')
    expect(cloud.inviteLink()).toContain('#/join/hid-1')
  })
})
