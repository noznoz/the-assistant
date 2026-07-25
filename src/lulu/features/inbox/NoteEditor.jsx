import React, { useState } from 'react'
import { Sheet, Field, TextArea, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'

export default function NoteEditor({ initial, onClose, onSaved }) {
  const { t } = useT()
  const notes = useCollection('notes')
  const [text, setText] = useState(initial?.text || '')

  const submit = () => {
    if (!text.trim()) return
    if (initial?.id) notes.save({ ...initial, text: text.trim() })
    else notes.add({ text: text.trim() })
    onSaved && onSaved()
    onClose()
  }

  return (
    <Sheet title={t('addNote')} onClose={onClose}
      footer={<Button variant="primary" block onClick={submit}>{t('save')}</Button>}>
      <Field label={t('notesField')}>
        <TextArea value={text} onChange={e => setText(e.target.value)} placeholder={t('capturePlaceholder')} autoFocus style={{ minHeight: 120 }} />
      </Field>
    </Sheet>
  )
}
