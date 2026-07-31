import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, TextArea, Select, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { STAFF_ROLES, findStaffRole, label } from '../../lib/domain.js'
import { money, toSar, fmtDate, daysUntil, relativeDay } from '../../lib/format.js'
import { makeThumb } from '../../lib/files.js'
import { whatsappToPerson } from '../../lib/share.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']

export default function StaffScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const staff = useCollection('staff')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const monthlyPayroll = staff.items.reduce((s, x) => s + toSar(x.salary || 0, x.currency || cur, rates), 0)

  return (
    <>
      <DetailHeader title={t('householdStaff')} onBack={() => go('more')} />
      <div className="screen">
        {staff.items.length === 0 ? (
          <Empty icon="people" title={t('noStaff')} text={t('staffHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addStaff')}</Button>} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <Stat label={t('monthlyPayroll')} value={money(monthlyPayroll, cur, lang)} />
              <Stat label={t('people')} value={String(staff.items.length)} />
            </div>
            <div style={{ marginTop: 14 }}>
              {staff.items.map(p => {
                const role = findStaffRole(p.role)
                const iqDd = daysUntil(p.iqamaExpiry)
                return (
                  <SwipeRow key={p.id} onEdit={() => setEditor(p)} onDelete={() => { staff.remove(p.id); toast.show(t('deletedToast')) }}>
                    <div className="li" onClick={() => setEditor(p)}>
                      <div className="lead" style={{ overflow: 'hidden', padding: p.photo ? 0 : undefined }}>
                        {p.photo ? <img src={p.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                          : <span className="t-brand"><Icon name={role?.icon || 'people'} size={18} /></span>}
                      </div>
                      <div className="body">
                        <div className="title">{p.name}</div>
                        <div className="meta">
                          {role ? label(role, lang) : ''}
                          {p.salary > 0 && <span>· {money(p.salary, p.currency || cur, lang)}/{t('mo')}</span>}
                          {iqDd != null && iqDd <= 60 && <span className={`chip ${iqDd < 0 ? 't-danger' : 't-warn'}`} style={{ padding: '1px 7px' }}>{t('iqama')} {iqDd < 0 ? t('expired') : relativeDay(p.iqamaExpiry, lang)}</span>}
                        </div>
                      </div>
                      {(p.whatsapp || p.mobile) && <button className="iconbtn" aria-label="WhatsApp" onClick={(e) => { e.stopPropagation(); whatsappToPerson(p, '') }}><Icon name="whatsapp" size={16} /></button>}
                    </div>
                  </SwipeRow>
                )
              })}
            </div>
          </>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <StaffEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function StaffEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const staff = useCollection('staff')
  const [f, setF] = useState({
    name: '', role: 'driver', photo: '', mobile: '', whatsapp: '', nationality: '',
    salary: '', currency: settings.currency, payDay: '', iqamaNumber: '', iqamaExpiry: '',
    passportNumber: '', passportExpiry: '', contractStart: '', contractEnd: '', note: '', ...initial,
  })
  const [err, setErr] = useState('')
  const photoRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pickPhoto = async (fl) => { const file = fl && fl[0]; if (!file) return; const thumb = await makeThumb(file, 320); if (thumb) setF(prev => ({ ...prev, photo: thumb })) }
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), salary: parseFloat(f.salary) || 0 }
    initial.id ? staff.save({ ...rec, id: initial.id }) : staff.add(rec)
    onSaved && onSaved(); onClose()
  }
  const initials = (f.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <Sheet title={initial.id ? t('editStaff') : t('addStaff')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { staff.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-tint)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 750, border: '1px solid var(--line)' }}>
          {f.photo ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <Button size="sm" icon="upload" onClick={() => photoRef.current?.click()}>{f.photo ? t('change') : t('addPhoto')}</Button>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files); e.target.value = '' }} />
      </div>
      <Field label={t('name')} required error={err}><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('role')}><Select value={f.role} onChange={set('role')} options={STAFF_ROLES.map(r => ({ value: r.id, label: label(r, lang) }))} /></Field>
        <Field label={t('nationality')} hint={t('optional')}><Input value={f.nationality} onChange={set('nationality')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('mobile')}><Input value={f.mobile} onChange={set('mobile')} inputMode="tel" placeholder="+9665…" /></Field>
        <Field label={t('whatsapp')}><Input value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="+9665…" /></Field>
      </div>
      <div className="row2">
        <Field label={t('salary')}><Input type="number" inputMode="decimal" value={f.salary} onChange={set('salary')} placeholder="0" /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <div style={{ margin: '10px 2px 8px', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{t('identityDocs')}</div>
      <div className="row2">
        <Field label={t('iqama') + ' — ' + t('number')}><Input value={f.iqamaNumber} onChange={set('iqamaNumber')} inputMode="numeric" /></Field>
        <Field label={t('iqama') + ' — ' + t('expiry')}><Input type="date" value={f.iqamaExpiry} onChange={set('iqamaExpiry')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('passport') + ' — ' + t('number')}><Input value={f.passportNumber} onChange={set('passportNumber')} /></Field>
        <Field label={t('passport') + ' — ' + t('expiry')}><Input type="date" value={f.passportExpiry} onChange={set('passportExpiry')} /></Field>
      </div>
      <div className="row2">
        <Field label={t('contractStart')} hint={t('optional')}><Input type="date" value={f.contractStart} onChange={set('contractStart')} /></Field>
        <Field label={t('contractEnd')} hint={t('optional')}><Input type="date" value={f.contractEnd} onChange={set('contractEnd')} /></Field>
      </div>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
