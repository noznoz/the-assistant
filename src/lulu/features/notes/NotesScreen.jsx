import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty, Fab, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { fmtDate } from '../../lib/format.js'
import NoteEditor from '../inbox/NoteEditor.jsx'

export default function NotesScreen({ go }) {
  const { t, lang } = useT()
  const notes = useCollection('notes')
  const tasks = useCollection('tasks')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const convertToTask = (note) => {
    tasks.add({ title: (note.text || '').slice(0, 120), type: 'task', status: 'new', priority: 'medium', classification: 'personal' })
    notes.remove(note.id)
    toast.show('→ ' + t('tasks'))
  }

  const list = [...notes.items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return (
    <>
      <DetailHeader title={t('quickNotes')} onBack={() => go('more')} />
      <div className="screen">
        {list.length === 0 ? (
          <Empty icon="note" title={t('nothingHere')} text={t('capturePlaceholder')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addNote')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {list.map(n => (
              <div className="li" key={n.id} onClick={() => setEditor(n)} style={{ alignItems: 'flex-start' }}>
                <div className="lead t-brand" style={{ marginTop: 2 }}><Icon name="note" size={18} /></div>
                <div className="body">
                  <div className="title" style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                  {n.createdAt && <div className="meta">{fmtDate(n.createdAt, lang)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && (
        <NoteEditor
          initial={editor.id ? editor : {}}
          onClose={() => setEditor(null)}
          onSaved={() => toast.show(t('savedToast'))}
          onConvert={convertToTask}
        />
      )}
      {toast.node}
    </>
  )
}
