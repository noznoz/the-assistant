// ============================================================================
// Identifies the built-in sample/seed records so they can be removed in one tap
// after a device data-reset re-created them (and a cloud re-sync mixed them in
// with real data).
//
// Strategy — safety first:
//  1. Records tagged { seed: true } by seed.js (going forward) always match.
//  2. Sample "parent" entities are found by tight signatures (sample vehicle
//     nicknames, the sample trip/project/departments, fake +9665000000xx
//     numbers). Everything that LINKS to them (expenses, services, docs, tasks…)
//     is then matched by that link — real records reference the user's real
//     entities, so they're never touched.
//  3. Standalone records use distinctive seed names/values.
//
// Deliberately conservative: it skips functional or ambiguous records
// (accounts, contact groups, document vaults, the prayer log) so nothing the
// app relies on — or that a user is likely to have created for real — is removed.
// ============================================================================

const FAKE_PHONE = /^\+9665000000\d\d$/
const inSet = (set, v) => v != null && set.has(v)

// Standalone (merchant|amount) fingerprints for personal expenses that don't
// link to a sample vehicle/trip/project (those are caught by cascade instead).
const EXP_SIG = new Set([
  'Nobu|120', 'Myazu|620', 'Apple Store|12000', 'Danube|190',
  'STC|480', 'STC|495', 'STC|470', 'Nozomi|320', 'Nozomi|410',
])

const TASK_SIG = new Set([
  'Approve Q3 marketing budget', 'Call Ahmed about the Jeddah contract',
  'Idea: quarterly family trip to AlUla', 'Board deck requested by CEO',
  'Discuss 2026 budget with CEO', 'Prepare Q3 operations report',
  'Vendor contract renewals', 'Weekly operations report', 'Follow up Q3 pipeline',
  'Signed off vendor SLA', 'Complete annual safety training',
  'Plan Q4 kickoff event', 'Send the board pack to Sara',
  'Finish school project & email teacher',
])

const NAME = {
  vehicles: ['Almas', 'Iron Raven', 'Blue Hour'],          // by nickname
  people: ['Khalid Al-Otaibi', 'Ahmed Al-Sayed', 'Sara Al-Nasser'],
  staff: ['Rahul', 'Maria', 'Joseph'],
  members: ['Faisal Al-Harbi', 'Sara Khan', 'Yousef Ali', 'Omar Nasser'],
  investments: ['Aramco shares', 'Global index fund'],
  properties: ['Family villa', 'Rental flat — Jeddah'],
  liabilities: ['Villa mortgage', 'Range Rover finance'],
  valuables: ['Rolex Submariner', 'MacBook Pro 16"', 'Samsung fridge'],
  wishlist: ['Patek Philippe Nautilus', 'Sony WH-1000XM6', 'PlayStation 5 Pro', 'Dyson Airwrap', 'Maldives family trip'],
  goals: ['Hajj fund', 'Maldives family trip', 'Emergency buffer'],
  subscriptions: ['Netflix', 'iCloud+', 'Car insurance'],
  rewards: ['Extra hour of screen time', 'Choose the weekend outing', 'New Lego set'],
  memberships: ['Saudia AlFursan', 'Hilton Honors', 'Fitness Time'],
  appointments: ['Pediatric check-up', 'Dental cleaning', 'Annual physical', 'School parents evening'],
}
const NW_VALUES = new Set([1620000, 1710000, 1795000, 1880000, 1948000, 2020000, 2088000, 2150000, 2214000])
const INCOME_NOTES = ['Monthly salary', 'Villa rent', 'Q2 performance bonus', 'Aramco shares']
const GIVING_CAUSES = ['Orphans', 'Mosque', 'Family in need']

// Returns [{ collection, id }, …] for every record judged to be sample data.
export function collectSampleRemovals(data) {
  const alive = (c) => (data[c] || []).filter(r => r && !r.deletedAt)
  const idsWhere = (c, pred) => new Set(alive(c).filter(pred).map(r => r.id))

  // Pass 1 — sample parent entities (for cascade matching).
  const veh = idsWhere('vehicles', r => r.seed === true || NAME.vehicles.includes(r.nickname))
  const trip = idsWhere('trips', r => r.seed === true || r.name === 'AlUla Family Trip')
  const proj = idsWhere('projects', r => r.seed === true || r.name === 'House Renovation')
  const dept = idsWhere('departments', r => r.seed === true || ['Regional operations team', 'Commercial team'].includes(r.note))
  const memb = idsWhere('members', r => r.seed === true || FAKE_PHONE.test(r.mobile || '') || NAME.members.includes(r.name))
  const ppl = idsWhere('people', r => r.seed === true || FAKE_PHONE.test(r.mobile || '') || NAME.people.includes(r.name))
  const prop = idsWhere('properties', r => r.seed === true || NAME.properties.includes(r.name))

  const out = []
  const push = (c, pred) => alive(c).forEach(r => { if (r.seed === true || pred(r)) out.push({ collection: c, id: r.id }) })
  const byName = (c) => push(c, r => NAME[c].includes(r.name))

  // Standalone-name collections.
  push('vehicles', r => NAME.vehicles.includes(r.nickname))
  push('people', r => FAKE_PHONE.test(r.mobile || '') || NAME.people.includes(r.name))
  push('staff', r => FAKE_PHONE.test(r.mobile || '') || NAME.staff.includes(r.name))
  push('members', r => FAKE_PHONE.test(r.mobile || '') || NAME.members.includes(r.name))
  push('departments', r => ['Regional operations team', 'Commercial team'].includes(r.note))
  push('trips', r => r.name === 'AlUla Family Trip')
  push('projects', r => r.name === 'House Renovation')
  byName('investments'); byName('properties'); byName('liabilities'); byName('valuables')
  byName('wishlist'); byName('goals'); byName('subscriptions'); byName('rewards'); byName('memberships')
  push('meetings', r => r.title === 'Weekly ops sync' || inSet(dept, r.departmentId))
  push('giving', r => GIVING_CAUSES.includes(r.cause))
  push('notes', r => (r.text || '').startsWith('Reminder: renew boat registration'))
  push('networth', r => NW_VALUES.has(r.value))
  push('income', r => INCOME_NOTES.includes(r.note))
  push('appointments', r => NAME.appointments.includes(r.title) || inSet(ppl, r.personId))

  // Cascade collections (safe: real records link to real entities).
  push('services', r => inSet(veh, r.vehicleId))
  push('accessories', r => inSet(veh, r.vehicleId))
  push('documents', r => inSet(veh, r.vehicleId) || r.title === 'Motorcycle license')
  push('itinerary', r => inSet(trip, r.tripId))
  push('propertylog', r => inSet(prop, r.propertyId))
  push('expenses', r => inSet(veh, r.relatedVehicle) || inSet(trip, r.tripId) || inSet(proj, r.projectId) || EXP_SIG.has(`${r.merchant}|${r.amount}`))
  push('tasks', r => inSet(veh, r.relatedVehicle) || inSet(trip, r.tripId) || inSet(dept, r.departmentId)
    || inSet(memb, r.memberId) || inSet(ppl, r.assigneeId) || TASK_SIG.has(r.title))

  // Dedup.
  const seen = new Set()
  return out.filter(({ collection, id }) => {
    const k = `${collection}:${id}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}
