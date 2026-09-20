import React, { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Field, Button } from './primitives.jsx'
import { useT } from '../i18n/I18nProvider.jsx'
import { saveAttachment, removeAttachment, shareAttachments } from '../lib/files.js'

// Reusable photo / file attachments field: take a photo or choose a file, see
// thumbnails, tap one to open/share it, remove with the ✕. Stores the same
// attachment metadata array (IndexedDB + cloud-backed) used elsewhere.
export default function AttachmentField({ value = [], onChange, label }) {
  const { t } = useT()
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const add = async (list) => {
    if (!list || !list.length) return
    setBusy(true)
    try {
      const added = []
      for (const file of Array.from(list)) added.push(await saveAttachment(file)) // eslint-disable-line no-await-in-loop
      onChange([...(value || []), ...added])
    } finally { setBusy(false) }
  }
  const remove = (a) => { removeAttachment(a); onChange((value || []).filter(x => x.id !== a.id)) }

  return (
    <Field label={label || t('attachments')}>
      <div className="row2">
        <Button icon="camera" onClick={() => camRef.current?.click()}>{t('takePhoto')}</Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>{t('chooseFile')}</Button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
        onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      {busy && <p className="muted" style={{ fontSize: 12, margin: '6px 2px' }}>
        <span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle' }} /> …
      </p>}
      {(value || []).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>
          {value.map(a => (
            <div key={a.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              <button onClick={() => shareAttachments([a])} aria-label={a.name || t('attachments')}
                style={{ all: 'unset', display: 'block', width: '100%', height: '100%', cursor: 'pointer' }}>
                {a.thumb ? <img src={a.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)' }}><Icon name="doc" size={20} /></div>}
              </button>
              <button onClick={() => remove(a)} aria-label={t('delete')}
                style={{ position: 'absolute', top: 2, insetInlineEnd: 2, width: 20, height: 20, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Field>
  )
}
