import React, { useState } from 'react'
import { Sheet, Field, TextArea, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'

export default function NoteEditor({ initial, onClose, onSaved, onConvert }) {
  const { t } = useT()
  const notes = useCollection('notes')
  const [text, setText] = useState(initial?.text || '')
  const editing = !!(initial && initial.id)

  const submit = () => {
    if (!text.trim()) return
    if (editing) notes.save({ ...initial, text: text.trim() })
    else notes.add({ text: text.trim() })
    onSaved && onSaved()
    onClose()
  }

  return (
    <Sheet title={editing ? t('edit') : t('addNote')} onClose={onClose}
      footer={
        <div className="stack">
          <Button variant="primary" block onClick={submit}>{t('save')}</Button>
          {editing && (
            <div className="row2">
              <Button icon="check" onClick={() => { onConvert && onConvert({ ...initial, text: text.trim() }); onClose() }}>{t('convertToTask')}</Button>
              <Button variant="danger" icon="trash" onClick={() => { notes.remove(initial.id); onClose() }}>{t('delete')}</Button>
            </div>
          )}
        </div>
      }>
      <Field label={t('notesField')}>
        <TextArea value={text} onChange={e => setText(e.target.value)} placeholder={t('capturePlaceholder')} autoFocus style={{ minHeight: 140 }} />
      </Field>
    </Sheet>
  )
}
