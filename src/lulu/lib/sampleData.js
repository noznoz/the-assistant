// ============================================================================
// Identifies the built-in sample/seed records so they can be removed in one tap.
//
// Safety-first rules (see TASK 0):
//  1. ONLY records the app itself seeded (seed === true) are ever removable.
//     A record without seed:true is never touched — no name/phone/amount
//     heuristics that could match something the user created for real.
//  2. "Adoption" protection: a seeded parent (vehicle, trip, project,
//     department, member, person, property) that has at least one NON-seed
//     (user-created) child linked to it is KEPT, along with everything linked
//     to it. So a sample vehicle the user has logged their own fuel or filed
//     their own documents against is never deleted — nor are the seeded records
//     hanging off it, which keeps that entity coherent.
// ============================================================================

// Parent entity types that can be "adopted" by a user-created child.
const PARENT_COLLS = ['vehicles', 'trips', 'projects', 'departments', 'members', 'people', 'properties']

// child collection, foreign-key field on the child, parent collection.
// Fields may hold a single id or an array of ids (e.g. tasks.departmentIds).
const LINKS = [
  ['services',     'vehicleId',      'vehicles'],
  ['accessories',  'vehicleId',      'vehicles'],
  ['documents',    'vehicleId',      'vehicles'],
  ['expenses',     'relatedVehicle', 'vehicles'],
  ['tasks',        'relatedVehicle', 'vehicles'],
  ['itinerary',    'tripId',         'trips'],
  ['expenses',     'tripId',         'trips'],
  ['tasks',        'tripId',         'trips'],
  ['expenses',     'projectId',      'projects'],
  ['tasks',        'projectId',      'projects'],
  ['members',      'departmentId',   'departments'],
  ['meetings',     'departmentId',   'departments'],
  ['tasks',        'departmentId',   'departments'],
  ['tasks',        'departmentIds',  'departments'],
  ['tasks',        'memberId',       'members'],
  ['tasks',        'memberIds',      'members'],
  ['appointments', 'personId',       'people'],
  ['tasks',        'assigneeId',     'people'],
  ['propertylog',  'propertyId',     'properties'],
]

// The parent ids a child record references through one field (scalar or array).
function refs(rec, field) {
  const v = rec[field]
  if (v == null || v === '') return []
  return (Array.isArray(v) ? v : [v]).filter(Boolean)
}

// Returns [{ collection, id }, …] for every record judged to be removable sample
// data — i.e. seed:true records that are not protected by adoption.
export function collectSampleRemovals(data) {
  const rows = (c) => (data[c] || []).filter(Boolean)
  const key = (c, id) => `${c}:${id}`

  // 1. Every seeded record is a removal candidate to begin with.
  const seededRecs = new Map() // key -> { collection, id }
  Object.keys(data || {}).forEach(c => rows(c).forEach(r => {
    if (r.seed === true) seededRecs.set(key(c, r.id), { collection: c, id: r.id })
  }))

  // Seeded parent ids per collection (only seeded parents can be "adopted"; a
  // user-created parent is already safe since it isn't seed:true).
  const seededParentIds = {}
  PARENT_COLLS.forEach(pc => {
    seededParentIds[pc] = new Set(rows(pc).filter(r => r.seed === true).map(r => r.id))
  })

  // 2. Walk the link graph once: map each seeded parent to its children, and
  //    flag parents that have at least one non-seed (user-created) child.
  const childrenOf = new Map()      // parentKey -> [{ collection, id }]
  const adoptedParents = new Set()  // parentKey with >=1 non-seed child
  LINKS.forEach(([childColl, field, parentColl]) => {
    const seededPids = seededParentIds[parentColl]
    rows(childColl).forEach(child => {
      refs(child, field).forEach(pid => {
        if (!seededPids.has(pid)) return // only care about seeded parents
        const pk = key(parentColl, pid)
        if (!childrenOf.has(pk)) childrenOf.set(pk, [])
        childrenOf.get(pk).push({ collection: childColl, id: child.id })
        if (child.seed !== true) adoptedParents.add(pk)
      })
    })
  })

  // 3. Protect adopted parents and cascade the protection down the link graph,
  //    so a kept sample vehicle also keeps its sample services/docs/expenses,
  //    and a kept department keeps its members and their tasks.
  const protectedSet = new Set()
  const queue = [...adoptedParents]
  while (queue.length) {
    const pk = queue.shift()
    if (protectedSet.has(pk)) continue
    protectedSet.add(pk)
    ;(childrenOf.get(pk) || []).forEach(({ collection, id }) => {
      const ck = key(collection, id)
      if (!protectedSet.has(ck)) queue.push(ck)
    })
  }

  // 4. Remove every seeded record that survived neither as an adopted parent nor
  //    as part of a protected subtree.
  const out = []
  seededRecs.forEach((rec, k) => { if (!protectedSet.has(k)) out.push(rec) })
  return out
}
