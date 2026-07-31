// Aggregates every date-bearing "this will expire" item across the app into one
// unified list for the Renewal Radar. Each entry: { id, icon, title, sub, date,
// days, go, cat } where `days` is whole days until expiry (negative = expired).
import { daysUntil } from './format.js'

// Person identity documents that matter in Saudi Arabia. Each maps a person
// field holding an ISO date to a human label key.
const PERSON_DOCS = [
  { field: 'iqamaExpiry', key: 'iqama', icon: 'shield' },
  { field: 'passportExpiry', key: 'passport', icon: 'trip' },
  { field: 'licenseExpiry', key: 'drivingLicense', icon: 'car' },
  { field: 'nationalIdExpiry', key: 'nationalId', icon: 'doc' },
  { field: 'healthCardExpiry', key: 'healthCard', icon: 'shield' },
]

export function buildRenewals({
  people = [], vehicles = [], documents = [], memberships = [],
  valuables = [], properties = [], staff = [], t, lang = 'en',
} = {}) {
  const out = []
  const add = (o) => { if (o.date) { const d = daysUntil(o.date); if (d != null) out.push({ ...o, days: d }) } }

  people.forEach(p => PERSON_DOCS.forEach(doc => {
    add({ id: `p-${doc.field}-${p.id}`, icon: doc.icon, cat: 'person',
      title: `${p.name} — ${t(doc.key)}`, sub: t('personal'), date: p[doc.field], go: 'people' })
  }))

  staff.forEach(s => {
    add({ id: `s-iq-${s.id}`, icon: 'shield', cat: 'staff', title: `${s.name} — ${t('iqama')}`, sub: t('householdStaff'), date: s.iqamaExpiry, go: 'staff' })
    add({ id: `s-pp-${s.id}`, icon: 'trip', cat: 'staff', title: `${s.name} — ${t('passport')}`, sub: t('householdStaff'), date: s.passportExpiry, go: 'staff' })
    add({ id: `s-ct-${s.id}`, icon: 'doc', cat: 'staff', title: `${s.name} — ${t('contractEnd')}`, sub: t('householdStaff'), date: s.contractEnd, go: 'staff' })
  })

  vehicles.forEach(v => {
    const name = v.nickname || v.name
    add({ id: `v-ins-${v.id}`, icon: 'shield', cat: 'vehicle', title: `${name} — ${t('insurance')}`, sub: v.insuranceCompany || '', date: v.policyExpiry, go: `garage/${v.id}` })
    add({ id: `v-reg-${v.id}`, icon: 'doc', cat: 'vehicle', title: `${name} — ${t('istimara')}`, sub: t('vehicleRegistration'), date: v.registrationExpiry, go: `garage/${v.id}` })
  })

  documents.forEach(d => add({ id: `d-${d.id}`, icon: 'doc', cat: 'document', title: d.title, sub: t('documents'), date: d.expiry, go: 'documents' }))
  memberships.forEach(m => add({ id: `m-${m.id}`, icon: 'gift', cat: 'membership', title: m.name, sub: t('memberships'), date: m.expiry, go: 'memberships' }))
  valuables.forEach(v => add({ id: `w-${v.id}`, icon: 'gift', cat: 'valuable', title: `${v.name} — ${t('warranty')}`, sub: v.brand || t('valuables'), date: v.warrantyExpiry, go: 'valuables' }))
  properties.forEach(p => {
    add({ id: `pr-c-${p.id}`, icon: 'doc', cat: 'property', title: `${p.name} — ${t('contractEnd')}`, sub: t('properties'), date: p.contractEnd, go: `properties/${p.id}` })
    add({ id: `pr-i-${p.id}`, icon: 'shield', cat: 'property', title: `${p.name} — ${t('insurance')}`, sub: t('properties'), date: p.insuranceExpiry, go: `properties/${p.id}` })
  })

  return out.sort((a, b) => a.days - b.days)
}

// Tint + urgency bucket for a days-until value.
export function urgency(days) {
  if (days < 0) return { key: 'expired', tint: 't-danger' }
  if (days <= 30) return { key: 'dueSoon', tint: 't-danger' }
  if (days <= 90) return { key: 'upcoming', tint: 't-warn' }
  return { key: 'later', tint: 't-info' }
}
