import React, { useState, useRef, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Sheet, Field, Input, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { DOC_CATEGORIES, docCategoryOptions, docCatLabel, label } from '../../lib/domain.js'
import { DOC_LINK_TYPES, docItemName, linkTypeOfDoc, resolveDocLink } from '../../lib/docLink.js'
import { fmtDate, daysUntil } from '../../lib/format.js'
import {
  saveAttachment, removeAttachment, getAttachmentFile, shareAttachments,
  downloadBlob, isImage, isPdf, humanSize,
} from '../../lib/files.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function DocumentsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const docs = useCollection('documents')
  const vehicles = useCollection('vehicles')
  const people = useCollection('people')
  const properties = useCollection('properties')
  const trips = useCollection('trips')
  const linkColls = { vehicles: vehicles.items, people: people.items, properties: properties.items, trips: trips.items }
  const [editor, setEditor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [filter, setFilter] = useState('all')
  const toast = useToast()

  // keep the viewed document in sync with store updates
  const current = viewing && docs.items.find(d => d.id === viewing.id)

  if (current) {
    return (
      <DocumentViewer
        doc={current}
        onBack={() => setViewing(null)}
        onEdit={() => { setEditor(current); setViewing(null) }}
        onDelete={async () => {
          for (const a of current.attachments || []) await removeAttachment(a)
          docs.remove(current.id); setViewing(null); toast.show(t('deletedToast'))
        }}
        onToast={toast.show}
      />
    )
  }

  return (
    <>
      <DetailHeader title={t('documents')} onBack={() => go('more')} />
      <div className="screen">
        {docs.items.length === 0 ? (
          <Empty icon="doc" title={t('nothingHere')} text={t('addFiles')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addDocument')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {(() => {
              // Category filter chips — only categories actually in use, plus All.
              const used = [...new Set(docs.items.map(d => d.category || 'other'))]
              const chips = [{ id: 'all', label: t('all') }].concat(used.map(id => ({ id, label: docCatLabel(id, lang) })))
              if (chips.length <= 2) return null
              return (
                <div className="chip-row" style={{ marginBottom: 6 }}>
                  {chips.map(c => (
                    <Chip key={c.id} selectable on={filter === c.id} onClick={() => setFilter(c.id)}>{c.label}</Chip>
                  ))}
                </div>
              )
            })()}
            {docs.items.filter(d => filter === 'all' || (d.category || 'other') === filter).map(d => {
              const dd = daysUntil(d.expiry)
              const thumb = (d.attachments || []).find(a => a.thumb)?.thumb
              const count = (d.attachments || []).length
              return (
                <SwipeRow key={d.id} onEdit={() => setEditor(d)}
                  onDelete={async () => { for (const a of d.attachments || []) await removeAttachment(a); docs.remove(d.id); toast.show(t('deletedToast')) }}>
                <div className="li" onClick={() => setViewing(d)}>
                  <div className="lead" style={{ padding: 0, overflow: 'hidden', background: 'var(--surface-2)' }}>
                    {thumb
                      ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Icon name={count ? 'doc' : 'doc'} size={18} />}
                  </div>
                  <div className="body">
                    <div className="title">{d.title}</div>
                    <div className="meta">
                      {docCatLabel(d.category, lang)}
                      {(() => { const lk = resolveDocLink(d, linkColls); return lk ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>· <Icon name={lk.icon} size={11} /> {lk.name}</span> : null })()}
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
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && (
        <DocEditor
          initial={editor.id ? editor : {}}
          onClose={() => setEditor(null)}
          onSaved={() => toast.show(t('savedToast'))}
          onToast={toast.show}
        />
      )}
      {toast.node}
    </>
  )
}

// ---------------------------------------------------------------------------
export function DocEditor({ initial, onClose, onSaved, onToast }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const docs = useCollection('documents')
  const vehicles = useCollection('vehicles')
  const people = useCollection('people')
  const properties = useCollection('properties')
  const trips = useCollection('trips')
  const linkColls = { vehicles: vehicles.items, people: people.items, properties: properties.items, trips: trips.items }
  const [f, setF] = useState({ title: '', category: 'id', expiry: '', notes: '', attachments: [], ...initial })
  const [busy, setBusy] = useState(false)
  const [newCat, setNewCat] = useState(null)
  const [linkType, setLinkType] = useState(() => linkTypeOfDoc(initial))
  const cameraRef = useRef()
  const fileRef = useRef()
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))

  const clearLinks = (obj) => { const o = { ...obj }; DOC_LINK_TYPES.forEach(l => { delete o[l.field] }); return o }
  const onLinkType = (e) => { setLinkType(e.target.value); setF(prev => clearLinks(prev)) }
  const onLinkItem = (field) => (e) => setF(prev => ({ ...clearLinks(prev), [field]: e.target.value || undefined }))
  const linkDef = DOC_LINK_TYPES.find(l => l.type === linkType)

  const onCategory = (e) => {
    if (e.target.value === '__addcat') { setNewCat(''); return }
    setF(prev => ({ ...prev, category: e.target.value }))
  }
  const addCategory = () => {
    const name = (newCat || '').trim()
    if (!name) { setNewCat(null); return }
    if (!(settings.customDocCategories || []).includes(name)) {
      updateSettings({ customDocCategories: [...(settings.customDocCategories || []), name] })
    }
    setF(prev => ({ ...prev, category: 'custom:' + name }))
    setNewCat(null)
  }

  const addFiles = async (fileList) => {
    if (!fileList || !fileList.length) return
    setBusy(true)
    try {
      const added = []
      for (const file of Array.from(fileList)) added.push(await saveAttachment(file))
      setF(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...added] }))
    } catch {
      onToast && onToast('Could not add file')
    } finally { setBusy(false) }
  }

  const removeAt = async (att) => {
    await removeAttachment(att)
    setF(prev => ({ ...prev, attachments: (prev.attachments || []).filter(a => a.id !== att.id) }))
  }

  const submit = () => {
    const title = f.title.trim() || (f.attachments[0]?.name) || t('documentTitle')
    const rec = { ...f, title }
    initial.id ? docs.save({ ...rec, id: initial.id }) : docs.add(rec)
    onSaved && onSaved()
    onClose()
  }

  return (
    <Sheet title={initial.id ? t('edit') : t('addDocument')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={async () => {
          for (const a of f.attachments || []) await removeAttachment(a)
          docs.remove(initial.id); onClose()
        }}>{t('delete')}</Button>}
      </div>}>

      {/* Capture / choose */}
      <div className="row2" style={{ marginBottom: 8 }}>
        <Button icon="camera" onClick={() => cameraRef.current?.click()}>{t('takePhoto')}</Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>{t('chooseFile')}</Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />

      {busy && <p className="muted" style={{ fontSize: 12, margin: '4px 2px' }}><span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle' }} /> …</p>}

      {(f.attachments || []).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '8px 0 16px' }}>
          {f.attachments.map(a => (
            <div key={a.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              {a.thumb
                ? <img src={a.thumb} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)' }}><Icon name="doc" size={26} /></div>}
              <button onClick={() => removeAt(a)} aria-label="remove" style={{
                position: 'absolute', top: 4, insetInlineEnd: 4, width: 24, height: 24, borderRadius: '50%',
                border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'grid', placeItems: 'center',
              }}><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <Field label={t('title')}><Input value={f.title} onChange={set('title')} placeholder={t('documentTitle')} /></Field>
      <Field label={t('category')}>
        <Select value={f.category} onChange={onCategory}>
          {docCategoryOptions(lang, settings.customDocCategories).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          <option value="__addcat">{t('addCategory')}</option>
        </Select>
      </Field>
      {newCat != null && (
        <div className="row2" style={{ marginTop: -6, marginBottom: 12 }}>
          <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder={t('customCategoryName')} autoFocus />
          <Button onClick={addCategory}>{t('add')}</Button>
        </div>
      )}
      <Field label={t('relatedTo')} hint={t('optional')}>
        <Select value={linkType} onChange={onLinkType}>
          <option value="">{t('none')}</option>
          {DOC_LINK_TYPES.map(l => <option key={l.type} value={l.type}>{t(l.tkey)}</option>)}
        </Select>
      </Field>
      {linkDef && (
        <Field label={t(linkDef.tkey)}>
          <Select value={f[linkDef.field] || ''} onChange={onLinkItem(linkDef.field)}>
            <option value="">{t('select')}</option>
            {(linkColls[linkDef.collection] || []).map(it => <option key={it.id} value={it.id}>{docItemName(it)}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t('policyExpiry')} hint={t('optional')}><Input type="date" value={f.expiry} onChange={set('expiry')} /></Field>
      <Field label={t('notesField')}><Input value={f.notes} onChange={set('notes')} /></Field>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
export function DocumentViewer({ doc, onBack, onEdit, onDelete, onToast }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const vehicles = useCollection('vehicles')
  const people = useCollection('people')
  const properties = useCollection('properties')
  const trips = useCollection('trips')
  const link = resolveDocLink(doc, { vehicles: vehicles.items, people: people.items, properties: properties.items, trips: trips.items })
  const catText = docCatLabel(doc.category, lang)
  const attachments = doc.attachments || []
  const [urls, setUrls] = useState({})   // id -> objectURL

  useEffect(() => {
    let live = true
    const created = []
    ;(async () => {
      const map = {}
      for (const a of attachments) {
        const file = await getAttachmentFile(a)
        if (file) { const u = URL.createObjectURL(file); map[a.id] = u; created.push(u) }
      }
      if (live) setUrls(map)
    })()
    return () => { live = false; created.forEach(u => URL.revokeObjectURL(u)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  const shareText = [
    doc.title,
    catText,
    doc.expiry ? `${t('policyExpiry')}: ${fmtDate(doc.expiry, lang, settings.dateFormat)}` : '',
  ].filter(Boolean).join('\n')

  const doShare = async () => {
    const res = await shareAttachments(attachments, shareText)
    if (res === 'downloaded') onToast && onToast(t('downloadedToast'))
    else if (res === 'shared') onToast && onToast(t('sharedToast'))
    else if (res === 'empty') onToast && onToast(t('noAttachments'))
  }

  const openOne = async (a) => {
    const u = urls[a.id]
    if (u) window.open(u, '_blank')
  }
  const downloadOne = async (a) => {
    const file = await getAttachmentFile(a)
    if (file) { downloadBlob(file, a.name); onToast && onToast(t('downloadedToast')) }
  }

  const dd = daysUntil(doc.expiry)

  return (
    <>
      <DetailHeader title={doc.title} onBack={onBack} right={
        <button className="iconbtn" onClick={onEdit} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
          <Chip tint="t-brand">{catText}</Chip>
          {link && <Chip tint="t-info"><Icon name={link.icon} size={12} /> {link.name}</Chip>}
          {doc.expiry && <Chip tint={dd != null && dd <= 7 ? 't-danger' : dd != null && dd <= 30 ? 't-warn' : ''}>
            {t('policyExpiry')}: {fmtDate(doc.expiry, lang, settings.dateFormat)}{dd != null && dd <= 30 ? ` · ${dd}d` : ''}
          </Chip>}
        </div>

        {doc.notes && <p style={{ marginBottom: 16, color: 'var(--ink-2)' }}>{doc.notes}</p>}

        {attachments.length === 0 ? (
          <Empty icon="camera" title={t('noAttachments')} text={t('addFiles')}
            action={<Button variant="primary" icon="camera" onClick={onEdit}>{t('takePhoto')}</Button>} />
        ) : (
          <div className="stack">
            {attachments.map((a, i) => (
              <div key={a.id} style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)' }}>
                {isImage(a) && urls[a.id] ? (
                  <img src={urls[a.id]} alt={a.name} loading="lazy" decoding="async" style={{ width: '100%', display: 'block' }} />
                ) : isPdf(a) ? (
                  <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="lead t-danger" style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="doc" size={22} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 650 }}>{a.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>PDF · {humanSize(a.size)}</div>
                    </div>
                    <Button size="sm" icon="upload" onClick={() => openOne(a)}>{t('openFile')}</Button>
                  </div>
                ) : (
                  <div style={{ padding: 20 }} className="muted">{a.name}</div>
                )}
                <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line)' }}>
                  <span className="muted" style={{ flex: 1, fontSize: 12, alignSelf: 'center' }}>{t('page')} {i + 1} · {humanSize(a.size)}</span>
                  <button className="iconbtn" onClick={() => downloadOne(a)} aria-label={t('download')}><Icon name="download" size={16} /></button>
                  <button className="iconbtn" onClick={() => openOne(a)} aria-label={t('openFile')}><Icon name="upload" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="stack" style={{ marginTop: 20 }}>
          <Button block variant="brand" icon="whatsapp" onClick={doShare} disabled={!attachments.length}>{t('shareViaWhatsApp')}</Button>
          <p className="center muted" style={{ fontSize: 12 }}>{t('shareHint')}</p>
          <Button block variant="danger" icon="trash" onClick={onDelete}>{t('delete')}</Button>
        </div>
      </div>
    </>
  )
}
