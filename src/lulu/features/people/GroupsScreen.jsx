import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Sheet, Field, Input, TextArea, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { GROUP_ICONS, SUGGESTED_GROUPS } from '../../lib/domain.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

// Manage contact groups (Family, Friends, Work, …). Each group has a name and
// an icon; people reference groups by id in their `groupIds` array.
export default function GroupsScreen({ go }) {
  const { t, lang } = useT()
  const groups = useCollection('groups')
  const people = useCollection('people')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const countFor = (id) => people.items.filter(p => (p.groupIds || []).includes(id)).length

  const deleteGroup = (id) => {
    if (!window.confirm(t('deleteGroupQ'))) return
    people.items.forEach(p => {
      if ((p.groupIds || []).includes(id)) people.patch(p.id, { groupIds: p.groupIds.filter(x => x !== id) })
    })
    groups.remove(id); toast.show(t('deletedToast'))
  }

  const addSuggested = () => {
    SUGGESTED_GROUPS.forEach(g => {
      const name = lang === 'ar' ? g.ar : g.en
      if (!groups.items.some(x => x.name === name)) groups.add({ name, icon: g.icon })
    })
    toast.show(t('savedToast'))
  }

  return (
    <>
      <DetailHeader title={t('groups')} onBack={() => go('people')} />
      <div className="screen">
        {groups.items.length === 0 ? (
          <Empty icon="people" title={t('noGroups')} text={t('groupsHint')}
            action={<div className="stack" style={{ width: '100%' }}>
              <Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newGroup')}</Button>
              <Button icon="sparkle" onClick={addSuggested}>{t('addSuggestedGroups')}</Button>
            </div>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {groups.items.map(g => (
              <SwipeRow key={g.id} onEdit={() => setEditor(g)} onDelete={() => deleteGroup(g.id)}>
              <div className="li" onClick={() => setEditor(g)}>
                <div className="lead t-brand"><Icon name={g.icon || 'people'} size={18} /></div>
                <div className="body">
                  <div className="title">{g.name}</div>
                  <div className="meta">{countFor(g.id)} {countFor(g.id) === 1 ? t('member') : t('members')}</div>
                </div>
                <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
              </SwipeRow>
            ))}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <GroupEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function GroupEditor({ initial, onClose, onSaved }) {
  const { t } = useT()
  const groups = useCollection('groups')
  const people = useCollection('people')
  const [f, setF] = useState({ name: '', icon: 'people', note: '', ...initial })
  const [err, setErr] = useState('')

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() }
    initial.id ? groups.save({ ...rec, id: initial.id }) : groups.add(rec)
    onSaved && onSaved(); onClose()
  }

  const doDelete = () => {
    if (!window.confirm(t('deleteGroupQ'))) return
    // Remove this group from every person's membership, then delete it.
    people.items.forEach(p => {
      if ((p.groupIds || []).includes(initial.id)) {
        people.patch(p.id, { groupIds: p.groupIds.filter(id => id !== initial.id) })
      }
    })
    groups.remove(initial.id)
    onClose()
  }

  return (
    <Sheet title={initial.id ? t('editGroup') : t('newGroup')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={doDelete}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('groupName')} required error={err}>
        <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder={t('groupNamePlaceholder')} autoFocus />
      </Field>
      <Field label={t('icon')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {GROUP_ICONS.map(name => {
            const on = f.icon === name
            return (
              <button key={name} onClick={() => setF({ ...f, icon: name })} aria-label={name} style={{
                aspectRatio: '1', borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer',
                border: on ? '2px solid var(--brand-600)' : '1px solid var(--line)',
                background: on ? 'var(--brand-tint)' : 'var(--surface-2)', color: on ? 'var(--brand-600)' : 'var(--ink-2)',
              }}><Icon name={name} size={20} /></button>
            )
          })}
        </div>
      </Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
