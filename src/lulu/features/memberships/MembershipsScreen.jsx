import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Sheet, Field, Input, TextArea, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { MEMBERSHIP_CATEGORIES, findMembershipCategory, label } from '../../lib/domain.js'
import { fmtDate, daysUntil } from '../../lib/format.js'
import { copyText } from '../../lib/share.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function MembershipsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const memberships = useCollection('memberships')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const copyNumber = (m) => { copyText(m.number || ''); toast.show(t('copiedToast')) }

  return (
    <>
      <DetailHeader title={t('memberships')} onBack={() => go('more')} />
      <div className="screen">
        {memberships.items.length === 0 ? (
          <Empty icon="gift" title={t('noMemberships')} text={t('membershipsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addMembership')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {memberships.items.map(m => {
              const c = findMembershipCategory(m.category)
              const dd = daysUntil(m.expiry)
              return (
                <SwipeRow key={m.id} onEdit={() => setEditor(m)} onDelete={() => { memberships.remove(m.id); toast.show(t('deletedToast')) }}>
                <div className="li" onClick={() => setEditor(m)}>
                  <div className="lead t-brand"><Icon name={c?.icon || 'gift'} size={18} /></div>
                  <div className="body">
                    <div className="title">{m.name}{m.tier ? ` · ${m.tier}` : ''}</div>
                    <div className="meta">
                      {m.number && <span className="tnum" dir="ltr">{m.number}</span>}
                      {m.expiry && <span className={dd != null && dd <= 30 ? 't-warn' : ''}>· {fmtDate(m.expiry, lang, settings.dateFormat)}</span>}
                    </div>
                  </div>
                  {m.number && <button className="iconbtn" aria-label={t('copy')} onClick={(e) => { e.stopPropagation(); copyNumber(m) }}><Icon name="duplicate" size={16} /></button>}
                </div>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <MembershipEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function MembershipEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const memberships = useCollection('memberships')
  const [f, setF] = useState({ name: '', category: 'airline', number: '', tier: '', expiry: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() }
    initial.id ? memberships.save({ ...rec, id: initial.id }) : memberships.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editMembership') : t('addMembership')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { memberships.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('membershipName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Saudia AlFursan, Hilton Honors…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('category')}><Select value={f.category} onChange={set('category')} options={MEMBERSHIP_CATEGORIES.map(c => ({ value: c.id, label: label(c, lang) }))} /></Field>
        <Field label={t('tier')} hint={t('optional')}><Input value={f.tier} onChange={set('tier')} placeholder="Gold, Platinum…" /></Field>
      </div>
      <Field label={t('membershipNumber')}><Input value={f.number} onChange={set('number')} dir="ltr" /></Field>
      <Field label={t('expiry')} hint={t('optional')}><Input type="date" value={f.expiry} onChange={set('expiry')} /></Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
