import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Sheet, Field, Input, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { DOC_CATEGORIES, label } from '../../lib/domain.js'
import { fmtDate, daysUntil } from '../../lib/format.js'

export default function DocumentsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const docs = useCollection('documents')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  return (
    <>
      <DetailHeader title={t('documents')} onBack={() => go('more')} />
      <div className="screen">
        {docs.items.length === 0 ? (
          <Empty icon="doc" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('add')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {docs.items.map(d => {
              const cat = DOC_CATEGORIES.find(c => c.id === d.category)
              const dd = daysUntil(d.expiry)
              return (
                <div className="li" key={d.id} onClick={() => setEditor(d)}>
                  <div className="lead t-info"><Icon name="doc" size={18} /></div>
                  <div className="body">
                    <div className="title">{d.title}</div>
                    <div className="meta">{label(cat, lang)}{d.expiry ? ` · ${fmtDate(d.expiry, lang, settings.dateFormat)}` : ''}</div>
                  </div>
                  {dd != null && dd <= 30 && <Chip tint={dd <= 7 ? 't-danger' : 't-warn'}>{dd}d</Chip>}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <DocEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function DocEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const docs = useCollection('documents')
  const [f, setF] = useState({ title: '', category: 'id', expiry: '', notes: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => { if (!f.title.trim()) return; initial.id ? docs.save({ ...f, id: initial.id }) : docs.add(f); onSaved && onSaved(); onClose() }
  return (
    <Sheet title={initial.id ? t('edit') : t('documents')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { docs.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('title')} required><Input value={f.title} onChange={set('title')} autoFocus /></Field>
      <Field label={t('category')}>
        <Select value={f.category} onChange={set('category')} options={DOC_CATEGORIES.map(c => ({ value: c.id, label: label(c, lang) }))} />
      </Field>
      <Field label={t('policyExpiry')} hint={t('optional')}><Input type="date" value={f.expiry} onChange={set('expiry')} /></Field>
      <Field label={t('notesField')}><Input value={f.notes} onChange={set('notes')} /></Field>
      <p className="muted" style={{ fontSize: 12 }}><Icon name="lock" size={12} /> Files & camera scanning arrive in Phase 2. Expiry reminders work today.</p>
    </Sheet>
  )
}
