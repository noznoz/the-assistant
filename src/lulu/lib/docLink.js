// A document can be linked to one entity via a foreign-key field. These helpers
// describe the available link types and resolve a document's link to a
// display-ready { icon, name } for the central Documents section.

export const DOC_LINK_TYPES = [
  { type: 'vehicle', field: 'vehicleId', collection: 'vehicles', icon: 'car', tkey: 'vehicle' },
  { type: 'person', field: 'personId', collection: 'people', icon: 'people', tkey: 'person' },
  { type: 'property', field: 'propertyId', collection: 'properties', icon: 'doc', tkey: 'property' },
  { type: 'trip', field: 'tripId', collection: 'trips', icon: 'trip', tkey: 'trip' },
]

export const docItemName = (rec) => rec ? (rec.nickname || rec.name || rec.title || '') : ''

export function linkTypeOfDoc(doc = {}) {
  const found = DOC_LINK_TYPES.find(l => doc[l.field])
  return found ? found.type : ''
}

// Resolve a document's link to { icon, name, type } using the provided
// collection arrays, or null if the document isn't linked to anything present.
export function resolveDocLink(doc, colls = {}) {
  for (const l of DOC_LINK_TYPES) {
    const id = doc[l.field]
    if (!id) continue
    const rec = (colls[l.collection] || []).find(x => x.id === id)
    if (rec) return { icon: l.icon, name: docItemName(rec), type: l.type }
  }
  return null
}
