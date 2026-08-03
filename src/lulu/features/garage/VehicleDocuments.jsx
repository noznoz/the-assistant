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
  const vaultName = (id) => (vaults.items.find(v => v.id === id) || {}).name
  const [editor, setEditor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const toast = useToast()

  const mine = docs.items.filter(d => d.vehicleId === vehicle.id)
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
          {mine.map(d => {
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
                    {vaultName(d.vaultId) && <span>· <Icon name="grid" size={11} /> {vaultName(d.vaultId)}</span>}
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
