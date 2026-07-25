import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Sheet, Field, Input, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { RELATIONSHIPS, label } from '../../lib/domain.js'

export default function PeopleScreen({ go }) {
  const { t, lang } = useT()
  const people = useCollection('people')
  const tasks = useCollection('tasks')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const openFor = (name) => tasks.items.filter(x => (x.assignedTo === name || x.requestedBy === name) && x.status !== 'completed' && x.status !== 'cancelled')

  return (
    <>
      <DetailHeader title={t('people')} onBack={() => go('more')} />
      <div className="screen">
        {people.items.length === 0 ? (
          <Empty icon="people" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addPerson')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {people.items.map(p => {
              const open = openFor(p.name)
              const initials = p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              const rel = RELATIONSHIPS.find(r => r.id === p.relationship)
              return (
                <div className="li" key={p.id} onClick={() => setEditor(p)}>
                  <div className="lead" style={{ background: 'var(--brand-tint)', color: 'var(--brand-600)', fontWeight: 750 }}>{initials}</div>
                  <div className="body">
                    <div className="title">{p.name}</div>
                    <div className="meta">{[p.jobTitle, rel ? label(rel, lang) : ''].filter(Boolean).join(' · ')}{open.length ? ` · ${open.length} ${lang === 'ar' ? 'مفتوحة' : 'open'}` : ''}</div>
                  </div>
                  {p.mobile && <a href={`https://wa.me/${p.mobile.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="iconbtn" onClick={e => e.stopPropagation()} style={{ color: 'var(--ok)' }}><Icon name="whatsapp" size={18} /></a>}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <PersonEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function PersonEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const people = useCollection('people')
  const [f, setF] = useState({ name: '', jobTitle: '', company: '', mobile: '', email: '', relationship: 'colleague', notes: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => { if (!f.name.trim()) return; initial.id ? people.save({ ...f, id: initial.id }) : people.add(f); onSaved && onSaved(); onClose() }
  return (
    <Sheet title={initial.id ? t('edit') : t('addPerson')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { people.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('name')} required><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('jobTitle')}><Input value={f.jobTitle} onChange={set('jobTitle')} /></Field>
        <Field label={t('company')}><Input value={f.company} onChange={set('company')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('mobile')}><Input value={f.mobile} onChange={set('mobile')} placeholder="+9665..." /></Field>
        <Field label={t('email')}><Input value={f.email} onChange={set('email')} /></Field>
      </div>
      <Field label={t('relationship')}>
        <Select value={f.relationship} onChange={set('relationship')} options={RELATIONSHIPS.map(r => ({ value: r.id, label: label(r, lang) }))} />
      </Field>
    </Sheet>
  )
}
