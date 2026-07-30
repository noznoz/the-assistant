import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader } from '../../ui/primitives.jsx'
import { Card, Button, Empty, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { suggestTriage } from '../../lib/triage.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

// Executive inbox — capture anything fast, triage into a task/note later.
export default function InboxScreen({ go }) {
  const { t, lang } = useT()
  const inbox = useCollection('inbox')
  const tasks = useCollection('tasks')
  const notes = useCollection('notes')
  const [text, setText] = useState('')
  const toast = useToast()

  const capture = () => {
    if (!text.trim()) return
    inbox.add({ text: text.trim() })
    setText('')
    toast.show(t('savedToast'))
  }

  const triage = (item) => {
    const s = suggestTriage(item.text)
    if (s.kind === 'task') {
      tasks.add({ title: s.title, type: s.type, priority: s.priority, status: 'new', dueDate: s.dueDate || '', classification: s.classification })
      inbox.remove(item.id)
      toast.show('→ ' + t('tasks'))
    } else {
      notes.add({ text: item.text }); inbox.remove(item.id); toast.show('→ ' + t('quickNotes'))
    }
  }

  return (
    <>
      <DetailHeader title={t('inbox')} onBack={() => go('more')} />
      <div className="screen">
        <p className="muted" style={{ margin: '14px 2px' }}>{t('inboxSubtitle')}</p>
        <Card>
          <textarea className="textarea" value={text} onChange={e => setText(e.target.value)}
            placeholder={t('capturePlaceholder')} style={{ minHeight: 70, border: 0, background: 'transparent', padding: 0 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="primary" icon="plus" onClick={capture} style={{ flex: 1 }}>{t('capture')}</Button>
            <button className="iconbtn" onClick={() => toast.show(t('comingSoon'))} aria-label={t('voice')}><Icon name="mic" size={18} /></button>
            <button className="iconbtn" onClick={() => toast.show(t('comingSoon'))} aria-label={t('camera')}><Icon name="camera" size={18} /></button>
          </div>
        </Card>

        <div style={{ marginTop: 18 }}>
          {inbox.items.length === 0 ? (
            <Empty icon="inbox" title={t('nothingHere')} text={t('inboxSubtitle')} />
          ) : inbox.items.map(item => {
            const s = suggestTriage(item.text)
            return (
              <SwipeRow key={item.id} onDelete={() => { inbox.remove(item.id); toast.show(t('deletedToast')) }}>
              <div className="li">
                <div className="lead t-info"><Icon name="inbox" size={18} /></div>
                <div className="body">
                  <div className="title" style={{ fontWeight: 500 }}>{item.text}</div>
                  <div className="meta">
                    <Chip tint="t-brand"><Icon name="sparkle" size={11} /> {s.kind === 'task' ? t('tt_' + (s.type === 'task' ? 'task' : s.type)) || t('addTask') : t('addNote')}</Chip>
                  </div>
                </div>
                <button className="btn sm" onClick={() => triage(item)}>{t('triage')}</button>
              </div>
              </SwipeRow>
            )
          })}
        </div>
      </div>
      {toast.node}
    </>
  )
}
