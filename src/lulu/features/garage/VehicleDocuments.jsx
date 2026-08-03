import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Button, Empty, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { docCatLabel } from '../../lib/domain.js'
import { fmtDate, daysUntil } from '../../lib/format.js'
import { removeAttachment } from '../../lib/files.js'
import SwipeRow from '../../ui/SwipeRow.jsx'
import { DocEditor, DocumentViewer } from '../documents/DocumentsScreen.jsx'

// Documents attached to one vehicle (registration, insurance, warranty…).
// Reuses the document vault (documents collection) with a vehicleId link, so
// the same files also appear in the central Documents section.
export default function VehicleDocuments({ vehicle }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const docs = useCollection('documents')
  const vaults = useCollection('vaults')
  // Full vault path, e.g. "Vehicles › Insurance" for a sub-vault.
  const vaultPath = (id) => {
    const parts = []; let cur = vaults.items.find(v => v.id === id); let guard = 0
    while (cur && guard++ < 12) { parts.unshift(cur.name); cur = cur.parentId ? vaults.items.find(v => v.id === cur.parentId) : null }
    return parts.join(' › ')
  }
  const [editor, setEditor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const toast = useToast()

  const mine = docs.items.filter(d => d.vehicleId === vehicle.id)
  // Group this vehicle's documents by vault (unfiled last).
  const groups = (() => {
    const m = new Map()
    mine.forEach(d => { const k = (d.vaultId && vaults.items.some(v => v.id === d.vaultId)) ? d.vaultId : '__none'; if (!m.has(k)) m.set(k, []); m.get(k).push(d) })
    const keys = [...m.keys()]
    keys.sort((a, b) => a === '__none' ? 1 : b === '__none' ? -1 : vaultPath(a).localeCompare(vaultPath(b)))
    return keys.map(k => ({ key: k, path: k === '__none' ? t('unfiled') : vaultPath(k), docs: m.get(k) }))
  })()
  const current = viewing && docs.items.find(d => d.id === viewing.id)

  if (current) {
    return (
      <DocumentViewer
        doc={current}
        onBack={() => setViewing(null)}
        onEdit={() => { setEditor(current); setViewing(null) }}
        onDelete={async () => { for (const a of current.attachments || []) await removeAttachment(a); docs.remove(current.id); setViewing(null); toast.show(t('deletedToast')) }}
        onToast={toast.show}
      />
    )
  }

  return (
    <>
      <Button block variant="primary" icon="plus" onClick={() => setEditor({ vehicleId: vehicle.id })}>{t('addDocument')}</Button>

      {mine.length === 0 ? (
        <Empty icon="doc" title={t('noVehicleDocs')} text={t('vehicleDocsHint')} />
      ) : (
        <div style={{ marginTop: 12 }}>
          {groups.map(g => (
            <div key={g.key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 2px 4px', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
                <Icon name={g.key === '__none' ? 'inbox' : 'grid'} size={13} /> {g.path}
                <span className="chip" style={{ marginInlineStart: 4 }}>{g.docs.length}</span>
              </div>
              {g.docs.map(d => {
                const dd = daysUntil(d.expiry)
                const thumb = (d.attachments || []).find(a => a.thumb)?.thumb
                const count = (d.attachments || []).length
                return (
                  <SwipeRow key={d.id} onEdit={() => setEditor(d)}
                    onDelete={async () => { for (const a of d.attachments || []) await removeAttachment(a); docs.remove(d.id); toast.show(t('deletedToast')) }}>
                  <div className="li" onClick={() => setViewing(d)}>
                    <div className="lead" style={{ padding: 0, overflow: 'hidden', background: 'var(--surface-2)' }}>
                      {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="doc" size={18} />}
                    </div>
                    <div className="body">
                      <div className="title">{d.title}</div>
                      <div className="meta">
                        {docCatLabel(d.category, lang)}
                        {count > 0 && <span>· {count} {count === 1 ? t('documentTitle') : t('attachments')}</span>}
                        {d.expiry && <span>· {fmtDate(d.expiry, lang, settings.dateFormat)}</span>}
                      </div>
                    </div>
                    {dd != null && dd <= 30 && <Chip tint={dd <= 7 ? 't-danger' : 't-warn'}>{dd}d</Chip>}
                  </div>
                  </SwipeRow>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <DocEditor
          initial={editor.id ? editor : { vehicleId: vehicle.id }}
          onClose={() => setEditor(null)}
          onSaved={() => toast.show(t('savedToast'))}
          onToast={toast.show}
        />
      )}
      {toast.node}
    </>
  )
}
