import React, { useState, useRef, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Empty, Button, Sheet, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { saveAttachment, removeAttachment, getAttachmentFile, saveCloudPhoto } from '../../lib/files.js'
import { usePhotoEditor } from '../../ui/PhotoEditor.jsx'

// A photo album for one vehicle. Photos are stored as attachments (full image
// in IndexedDB + a small thumbnail on the record), so the album stays light.
export default function VehiclePhotos({ vehicle }) {
  const { t } = useT()
  const vehicles = useCollection('vehicles')
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState(null)   // attachment being viewed full-size
  const [url, setUrl] = useState('')
  const cameraRef = useRef()
  const fileRef = useRef()
  const toast = useToast()

  const album = vehicle.album || []

  // Load the full-size image for the viewer overlay.
  useEffect(() => {
    let live = true, obj = ''
    if (!viewer) { setUrl(''); return }
    ;(async () => {
      const file = await getAttachmentFile(viewer)
      if (file && live) { obj = URL.createObjectURL(file); setUrl(obj) }
    })()
    return () => { live = false; if (obj) URL.revokeObjectURL(obj) }
  }, [viewer])

  const photo = usePhotoEditor()
  const addPhotos = (fileList) => {
    if (!fileList || !fileList.length) return
    const base = vehicle.album || []
    const collected = []
    photo.open(Array.from(fileList), async (edited) => {
      try {
        const att = await saveAttachment(edited)
        collected.push(att)
        vehicles.patch(vehicle.id, { album: [...base, ...collected] })
      } catch { toast.show(t('comingSoon')) }
    }, { aspect: 4 / 3, size: 1600, onComplete: () => { if (collected.length) toast.show(t('savedToast')) } })
  }

  const removePhoto = async (att) => {
    await removeAttachment(att)
    vehicles.patch(vehicle.id, { album: album.filter(a => a.id !== att.id) })
    setViewer(null); toast.show(t('deletedToast'))
  }

  const setAsCover = async (att) => {
    setBusy(true)
    try {
      const file = await getAttachmentFile(att)
      const out = file ? await saveCloudPhoto(file, { thumbMax: 640, fullMax: 2000 }) : { photo: att.thumb || '', photoId: '' }
      if (out.photo) vehicles.patch(vehicle.id, { photo: out.photo, photoId: out.photoId, photoPos: '50% 50%' })
      toast.show('✓ ' + t('setAsCover'))
      setViewer(null)
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="row2" style={{ margin: '4px 0 12px' }}>
        <Button icon="camera" onClick={() => cameraRef.current?.click()}>{t('takePhoto')}</Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>{t('addPhotos')}</Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />

      {busy && <p className="muted" style={{ fontSize: 12, margin: '4px 2px' }}><span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle' }} /> …</p>}

      {album.length === 0 ? (
        <Empty icon="camera" title={t('noPhotos')} text={t('photosHint')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {album.map(a => (
            <button key={a.id} onClick={() => setViewer(a)} style={{
              aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)',
              background: 'var(--surface-2)', padding: 0, cursor: 'pointer',
            }}>
              {a.thumb ? <img src={a.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon name="camera" size={22} style={{ color: 'var(--ink-3)' }} />}
            </button>
          ))}
        </div>
      )}

      {viewer && (
        <Sheet title={t('photos')} onClose={() => setViewer(null)}
          footer={<div className="stack">
            <Button variant="primary" block icon="car" onClick={() => setAsCover(viewer)}>{t('setAsCover')}</Button>
            <Button block variant="danger" icon="trash" onClick={() => removePhoto(viewer)}>{t('delete')}</Button>
          </div>}>
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface-2)', minHeight: 200, display: 'grid', placeItems: 'center' }}>
            {url ? <img src={url} alt="" style={{ width: '100%', display: 'block' }} />
              : <span className="spinner" style={{ width: 22, height: 22 }} />}
          </div>
        </Sheet>
      )}
      {photo.node}
      {toast.node}
    </>
  )
}
