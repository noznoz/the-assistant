import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import QuickCapture from '../today/QuickCapture.jsx'
import TaskEditor from '../tasks/TaskEditor.jsx'
import ExpenseEditor from '../expenses/ExpenseEditor.jsx'
import NoteEditor from '../inbox/NoteEditor.jsx'
import { ApptEditor } from '../appointments/AppointmentsScreen.jsx'

// The + button on every screen that doesn't have its own add button (CSS hides
// it when a screen's own .fab is present). It opens one "Add" panel: type or
// speak a sentence and Lulu works out what it is, or pick what to add from six
// large tiles.
const TILES = [
  { id: 'task', icon: 'check', key: 'cap_task' },
  { id: 'reminder', icon: 'bell', key: 'cap_reminder' },
  { id: 'expense', icon: 'wallet', key: 'cap_expense' },
  { id: 'appointment', icon: 'calendar', key: 'cap_appointment' },
  { id: 'note', icon: 'note', key: 'cap_note' },
  { id: 'receipt', icon: 'receipt', key: 'scanReceipt' },
]

export default function AddButton({ go }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [editor, setEditor] = useState(null)
  const toast = useToast()
  const close = () => setEditor(null)
  const saved = () => toast.show(t('savedToast'))

  const pick = (id) => {
    setOpen(false)
    // Reminders are added from the form at the top of the Reminders screen.
    if (id === 'reminder') { go('reminders'); return }
    setEditor(id)
  }

  return (
    <>
      <button className="fab fab-global" onClick={() => setOpen(true)} aria-label={t('add')}>
        <Icon name="plus" size={26} />
      </button>

      {open && (
        <Sheet title={t('addWhat')} onClose={() => setOpen(false)}>
          <QuickCapture toast={toast} autoFocus
            go={(s) => { setOpen(false); go(s) }}
            onAdded={() => setOpen(false)} />
          <p className="muted" style={{ fontSize: 15, margin: '2px 2px 0' }}>{t('addWhatHint')}</p>
          <div className="add-tiles">
            {TILES.map(tile => (
              <button key={tile.id} className="add-tile" onClick={() => pick(tile.id)}>
                <span className="ic"><Icon name={tile.icon} size={24} /></span>
                {t(tile.key)}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {editor === 'task' && <TaskEditor onClose={close} onSaved={saved} />}
      {editor === 'expense' && <ExpenseEditor onClose={close} onSaved={saved} />}
      {editor === 'receipt' && <ExpenseEditor autoScan onClose={close} onSaved={saved} />}
      {editor === 'appointment' && <ApptEditor initial={{}} onClose={close} onSaved={saved} />}
      {editor === 'note' && <NoteEditor onClose={close} onSaved={saved} />}
      {toast.node}
    </>
  )
}
