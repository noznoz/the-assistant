import { describe, test, expect } from 'vitest'
import { mergeSettings, pickSynced, payload, changedEntries } from './settingsSync.js'

const PHOTO = 'data:image/jpeg;base64,AAA'
const T = (h) => `2026-11-23T${String(h).padStart(2, '0')}:00:00.000Z`
// Apply a merge result to a device, like the store does.
const apply = (dev, r) => (r.patch ? { ...dev, ...r.patch } : dev)

describe('settings sync — field by field', () => {
  test('only personal data travels, not device preferences', () => {
    const v = pickSynced({ language: 'ar', theme: 'dark', profile: { photo: PHOTO }, currency: 'SAR' })
    expect(v.profile.photo).toBe(PHOTO)
    expect(v.language).toBeUndefined()
    expect(v.theme).toBeUndefined()
  })

  test('the reported case: the Mac changed something later, the photo still reaches it and the phone keeps it', () => {
    // Phone: profile with a photo from before stamps; synced once at 10:00.
    let phone = { language: 'ar', profile: { fullName: 'Nizar', photo: PHOTO }, monthlyBudget: 3000, currency: 'SAR', settingsSyncedOnce: true, settingsUpdatedAt: T(10) }
    // Mac: synced first with nothing, then changed the currency at 12:00.
    let mac = { language: 'en', profile: {}, currency: 'USD', settingsSyncedOnce: true, settingsUpdatedAt: T(12), settingsStamps: { currency: T(12) } }
    // Cloud currently holds the Mac's copy (newer whole-copy time).
    let cloud = payload(mac)

    // Phone syncs: it must NOT lose the photo, and must upload it.
    const rp = mergeSettings(phone, cloud); phone = apply(phone, rp)
    expect(phone.profile.photo).toBe(PHOTO)
    expect(phone.currency).toBe('USD') // the newer currency change does arrive
    expect(rp.push).toBe(true)
    cloud = payload(phone)

    // Mac syncs: gets the photo, keeps its language.
    mac = apply(mac, mergeSettings(mac, cloud))
    expect(mac.profile.photo).toBe(PHOTO)
    expect(mac.profile.fullName).toBe('Nizar')
    expect(mac.monthlyBudget).toBe(3000)
    expect(mac.language).toBe('en')
  })

  test('a fresh device never wipes a filled profile, whichever syncs first', () => {
    const emptyMacFirst = payload({ profile: {}, name: '' })
    let phone = { profile: { fullName: 'Nizar', photo: PHOTO } }
    const r = mergeSettings(phone, emptyMacFirst); phone = apply(phone, r)
    expect(phone.profile.photo).toBe(PHOTO)
    expect(r.push).toBe(true)
  })

  test('an old-style cloud copy (from the previous version) merges safely', () => {
    const oldStyle = { values: { profile: { fullName: 'Old name' }, currency: 'SAR' }, updatedAt: T(9) }
    let mac = { profile: {} }
    mac = apply(mac, mergeSettings(mac, oldStyle))
    expect(mac.profile.fullName).toBe('Old name')
    let phone = { profile: { photo: PHOTO }, settingsSyncedOnce: true, settingsUpdatedAt: T(10) }
    phone = apply(phone, mergeSettings(phone, oldStyle))
    expect(phone.profile.photo).toBe(PHOTO) // photo kept
    expect(phone.profile.fullName).toBe('Old name') // missing field filled
  })

  test('newer edits win per field, both ways', () => {
    let a = { profile: { fullName: 'N', photo: PHOTO }, settingsSyncedOnce: true, settingsStamps: { 'profile.fullName': T(9), 'profile.photo': T(9) } }
    let b = { profile: { fullName: 'Nizar B.', photo: PHOTO }, settingsSyncedOnce: true, settingsStamps: { 'profile.fullName': T(11), 'profile.photo': T(9) } }
    a = apply(a, mergeSettings(a, payload(b)))
    expect(a.profile.fullName).toBe('Nizar B.')
    // b removes the photo later → removal travels
    b = { ...b, profile: { fullName: 'Nizar B.', photo: '' }, settingsStamps: { ...b.settingsStamps, 'profile.photo': T(13) } }
    a = apply(a, mergeSettings(a, payload(b)))
    expect(a.profile.photo).toBe('')
  })

  test('identical copies: nothing to do', () => {
    const d = { profile: { photo: PHOTO }, settingsSyncedOnce: true, settingsStamps: { 'profile.photo': T(9) } }
    expect(mergeSettings(d, payload(d))).toEqual({ patch: null, push: false })
  })

  test('changedEntries finds the exact fields edited', () => {
    expect(changedEntries({ profile: { a: 1, photo: 'x' }, currency: 'SAR' }, { profile: { a: 1, photo: 'y' }, currency: 'SAR' })).toEqual(['profile.photo'])
  })
})
