import { describe, test, expect } from 'vitest'
import { mergeSettings, pickSynced } from './settingsSync.js'

const phone = {
  language: 'ar', theme: 'dark', settingsSyncedOnce: true, settingsUpdatedAt: '2026-11-23T10:00:00.000Z',
  name: 'Nizar', currency: 'SAR', monthlyBudget: 3000,
  profile: { fullName: 'Nizar', photo: 'data:image/jpeg;base64,AAA', photoId: 'x1', mobile: '0550000000' },
}
const remoteOf = (s) => ({ values: pickSynced(s), updatedAt: s.settingsUpdatedAt })

describe('settings sync', () => {
  test('only personal data travels, not device preferences', () => {
    const v = pickSynced(phone)
    expect(v.profile.photo).toBeTruthy()
    expect(v.language).toBeUndefined()
    expect(v.theme).toBeUndefined()
  })

  test('a fresh MacBook gets the photo and profile from the phone', () => {
    const mac = { language: 'en', profile: {}, monthlyBudget: 0, name: '' }
    const r = mergeSettings(mac, remoteOf(phone), '2026-11-23T11:00:00.000Z')
    expect(r.patch.profile).toEqual(phone.profile)
    expect(r.patch.monthlyBudget).toBe(3000)
    expect(r.patch.name).toBe('Nizar')
    expect(r.patch.language).toBeUndefined() // the Mac keeps its own language
    expect(r.push).toBe(true)
  })

  test('a fresh device that synced first can never wipe a filled profile', () => {
    // The empty Mac uploaded first; then the phone (never synced) pulls it.
    const emptyMac = { values: { profile: {}, monthlyBudget: 0, name: '' }, updatedAt: '2026-11-23T09:00:00.000Z' }
    const neverSyncedPhone = { ...phone, settingsSyncedOnce: undefined, settingsUpdatedAt: undefined }
    const r = mergeSettings(neverSyncedPhone, emptyMac, '2026-11-23T12:00:00.000Z')
    expect(r.patch.profile).toEqual(phone.profile)
    expect(r.patch.monthlyBudget).toBeUndefined() // phone's 3000 kept as is
    expect(r.push).toBe(true)
  })

  test('first sync merges field by field inside the profile', () => {
    const local = { profile: { fullName: 'Nizar', mobile: '' } }
    const remote = { values: { profile: { fullName: 'Old', mobile: '0551112222', photo: 'data:x' } }, updatedAt: 't' }
    expect(mergeSettings(local, remote).patch.profile).toEqual({ fullName: 'Nizar', mobile: '0551112222', photo: 'data:x' })
  })

  test('after the first sync, the newer copy wins', () => {
    const mac = { ...phone, settingsUpdatedAt: '2026-11-23T09:00:00.000Z', profile: { fullName: 'Old' } }
    const newer = mergeSettings(mac, remoteOf(phone))
    expect(newer.patch.profile).toEqual(phone.profile)
    expect(newer.push).toBe(false)
    const older = mergeSettings(phone, { values: { profile: {} }, updatedAt: '2026-11-22T00:00:00.000Z' })
    expect(older.patch).toBe(null)
    expect(older.push).toBe(true)
    expect(mergeSettings(phone, remoteOf(phone))).toEqual({ patch: null, stamp: phone.settingsUpdatedAt, push: false })
  })

  test('nothing in the cloud yet: upload ours', () => {
    const r = mergeSettings({ profile: { fullName: 'N' } }, null, 'now')
    expect(r.push).toBe(true)
    expect(r.patch.settingsSyncedOnce).toBe(true)
  })
})
