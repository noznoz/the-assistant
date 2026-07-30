import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Field, Input, Select, Button, Chip } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { RELATIONSHIPS, label } from '../../lib/domain.js'
import { makeThumb } from '../../lib/files.js'

// Shared person/family editor. `onSaved(person)` receives the saved record so
// callers (e.g. the task editor) can immediately select a newly-added member.
export default function PersonEditor({ initial = {}, onClose, onSaved }) {
  const { t, lang } = useT()
  const people = useCollection('people')
  const groups = useCollection('groups')
  const [f, setF] = useState({
    name: '', photo: '', jobTitle: '', company: '', mobile: '', whatsapp: '',
    email: '', relationship: 'family', birthday: '', notes: '', groupIds: [],
    bloodType: '', allergies: '', conditions: '', medications: '', doctor: '', healthInsurer: '', healthPolicy: '',
    iqamaNumber: '', iqamaExpiry: '', passportNumber: '', passportExpiry: '', licenseExpiry: '', nationalId: '', nationalIdExpiry: '', ...initial,
  })
  const toggleGroup = (id) => setF(prev => {
    const cur = prev.groupIds || []
    return { ...prev, groupIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }
  })
  const [err, setErr] = useState('')
  const photoRef = useRef()
  const cameraRef = useRef()
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))

  const pickPhoto = async (fileList) => {
    const file = fileList && fileList[0]
    if (!file) return
    const thumb = await makeThumb(file, 320)
    if (thumb) setF(prev => ({ ...prev, photo: thumb }))
  }

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() }
    const saved = initial.id ? people.save({ ...rec, id: initial.id }) : people.add(rec)
    onSaved && onSaved(saved)
    onClose()
  }

  const initials = (f.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <Sheet title={initial.id ? t('edit') : t('addFamily')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { people.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 92, height: 92, borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-tint)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 750, border: '1px solid var(--line)' }}>
          {f.photo ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" icon="camera" onClick={() => cameraRef.current?.click()}>{t('takePhoto')}</Button>
          <Button size="sm" icon="upload" onClick={() => photoRef.current?.click()}>{t('photo')}</Button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { pickPhoto(e.target.files); e.target.value = '' }} />
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files); e.target.value = '' }} />
      </div>

      <Field label={t('name')} required error={err}><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label={t('relationship')}>
        <Select value={f.relationship} onChange={set('relationship')} options={RELATIONSHIPS.map(r => ({ value: r.id, label: label(r, lang) }))} />
      </Field>
      {groups.items.length > 0 && (
        <Field label={t('groups')}>
          <div className="chip-row">
            {groups.items.map(g => (
              <Chip key={g.id} selectable on={(f.groupIds || []).includes(g.id)} onClick={() => toggleGroup(g.id)}>
                <Icon name={g.icon || 'people'} size={13} /> {g.name}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <div className="row2">
        <Field label={t('mobile')}><Input value={f.mobile} onChange={set('mobile')} placeholder="+9665…" inputMode="tel" /></Field>
        <Field label={t('whatsapp')}><Input value={f.whatsapp} onChange={set('whatsapp')} placeholder="+9665…" inputMode="tel" /></Field>
      </div>
      <div className="row2">
        <Field label={t('email')}><Input value={f.email} onChange={set('email')} inputMode="email" /></Field>
        <Field label={t('birthday')}><Input type="date" value={f.birthday} onChange={set('birthday')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('jobTitle')}><Input value={f.jobTitle} onChange={set('jobTitle')} /></Field>
        <Field label={t('company')}><Input value={f.company} onChange={set('company')} /></Field>
      </div>
      <Field label={t('notesField')}><Input value={f.notes} onChange={set('notes')} /></Field>

      <div style={{ margin: '4px 2px 8px', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{t('healthMedical')}</div>
      <div className="row2">
        <Field label={t('bloodType')}>
          <Select value={f.bloodType} onChange={set('bloodType')} options={[''].concat(['A+','A-','B+','B-','AB+','AB-','O+','O-']).map(v => ({ value: v, label: v || '—' }))} />
        </Field>
        <Field label={t('doctor')}><Input value={f.doctor} onChange={set('doctor')} /></Field>
      </div>
      <Field label={t('allergies')}><Input value={f.allergies} onChange={set('allergies')} placeholder={t('allergiesPlaceholder')} /></Field>
      <Field label={t('conditions')}><Input value={f.conditions} onChange={set('conditions')} /></Field>
      <Field label={t('medications')}><Input value={f.medications} onChange={set('medications')} /></Field>
      <div className="row2">
        <Field label={t('healthInsurer')}><Input value={f.healthInsurer} onChange={set('healthInsurer')} /></Field>
        <Field label={t('healthPolicy')}><Input value={f.healthPolicy} onChange={set('healthPolicy')} /></Field>
      </div>

      <div style={{ margin: '10px 2px 8px', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{t('identityDocs')}</div>
      <p className="hint" style={{ margin: '0 2px 8px' }}>{t('identityDocsHint')}</p>
      <div className="row2">
        <Field label={t('iqama') + ' — ' + t('number')}><Input value={f.iqamaNumber} onChange={set('iqamaNumber')} inputMode="numeric" /></Field>
        <Field label={t('iqama') + ' — ' + t('expiry')}><Input type="date" value={f.iqamaExpiry} onChange={set('iqamaExpiry')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('passport') + ' — ' + t('number')}><Input value={f.passportNumber} onChange={set('passportNumber')} /></Field>
        <Field label={t('passport') + ' — ' + t('expiry')}><Input type="date" value={f.passportExpiry} onChange={set('passportExpiry')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('nationalId')}><Input value={f.nationalId} onChange={set('nationalId')} inputMode="numeric" /></Field>
        <Field label={t('drivingLicense') + ' — ' + t('expiry')}><Input type="date" value={f.licenseExpiry} onChange={set('licenseExpiry')} /></Field>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        <Icon name="whatsapp" size={12} /> {t('sendTaskHint')}
      </p>
    </Sheet>
  )
}
