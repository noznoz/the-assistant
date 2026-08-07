import React, { useState, useEffect, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Select, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { saveCloudPhoto } from '../../lib/files.js'
import { usePhotoEditor } from '../../ui/PhotoEditor.jsx'
import { share } from '../../lib/share.js'

// The owner's personal profile: identity, contact, Saudi National Address,
// work and emergency details. Stored in settings.profile (a single object)
// so it exports/imports with the rest of the backup and syncs later.
export default function ProfileScreen({ go }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const toast = useToast()
  const photoRef = useRef()
  const [busy, setBusy] = useState(false)

  // Local form is the single source of truth while editing; we mirror it into
  // settings.profile on change (functional update = no stale-keystroke bugs).
  const [form, setForm] = useState(() => ({ ...(settings.profile || {}) }))
  useEffect(() => { updateSettings({ profile: form }) }, [form]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { const v = e.target.value; setForm(prev => ({ ...prev, [k]: v })) }

  const photo = usePhotoEditor()
  const onPhoto = (fileList) => {
    const file = fileList && fileList[0]
    if (!file) return
    photo.open(file, async (edited) => {
      setBusy(true)
      try { const out = await saveCloudPhoto(edited, { thumbMax: 320 }); if (out.photo) setForm(prev => ({ ...prev, ...out })) }
      finally { setBusy(false) }
    }, { aspect: 1, round: true, size: 800 })
  }

  const initials = (form.fullName || settings.name || '')
    .split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'NB'

  const shareAddress = () => {
    const L = lang === 'ar'
    const lines = [
      L ? '📍 العنوان الوطني' : '📍 National Address',
      form.fullName && `${form.fullName}`,
      form.shortAddress && `${L ? 'العنوان المختصر' : 'Short address'}: ${form.shortAddress}`,
      form.buildingNo && `${L ? 'رقم المبنى' : 'Building'}: ${form.buildingNo}`,
      form.street && `${L ? 'الشارع' : 'Street'}: ${form.street}`,
      form.district && `${L ? 'الحي' : 'District'}: ${form.district}`,
      form.city && `${L ? 'المدينة' : 'City'}: ${form.city}`,
      form.postalCode && `${L ? 'الرمز البريدي' : 'Postal code'}: ${form.postalCode}`,
      form.additionalNo && `${L ? 'الرقم الإضافي' : 'Additional no.'}: ${form.additionalNo}`,
    ].filter(Boolean)
    if (lines.length <= 1) { toast.show(t('addAddressFirst')); return }
    share(lines.join('\n'))
  }

  return (
    <>
      <DetailHeader title={t('myProfile')} onBack={() => go('more')} right={
        <button className="iconbtn" onClick={shareAddress} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        {/* Hero */}
        <Card style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button onClick={() => photoRef.current?.click()} aria-label={t('choosePhoto')} style={{
            position: 'relative', width: 72, height: 72, borderRadius: '50%', border: 0, flexShrink: 0,
            overflow: 'hidden', background: 'var(--brand-tint)', color: 'var(--brand-600)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}>
            {form.photo
              ? <img src={form.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontWeight: 780, fontSize: 26, letterSpacing: '0.02em' }}>{initials}</span>}
            {busy && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.35)' }}><span className="spinner" style={{ width: 20, height: 20 }} /></div>}
            <span style={{
              position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 24, height: 24, borderRadius: '50%',
              background: 'var(--brand-600)', color: '#fff', display: 'grid', placeItems: 'center', border: '2px solid var(--surface)',
            }}><Icon name="camera" size={12} /></span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 750, fontSize: 18 }}>{form.fullName || settings.name || t('yourName')}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {[form.jobTitle, form.nationalId && `${t('nationalId')} ${form.nationalId}`].filter(Boolean).join(' · ') || t('tapToComplete')}
            </div>
          </div>
        </Card>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files); e.target.value = '' }} />

        {/* Personal */}
        <Section title={t('personalInfo')} />
        <Card className="stack">
          <Field label={t('fullName')}><Input value={form.fullName || ''} onChange={set('fullName')} placeholder="Nizar Bukhari" /></Field>
          <Field label={t('fullNameAr')}><Input value={form.fullNameAr || ''} onChange={set('fullNameAr')} placeholder="نزار بخاري" dir="rtl" /></Field>
          <div className="row2">
            <Field label={t('nationalId')}><Input inputMode="numeric" value={form.nationalId || ''} onChange={set('nationalId')} placeholder="10xxxxxxxx" /></Field>
            <Field label={t('dateOfBirth')}><Input type="date" value={form.dob || ''} onChange={set('dob')} /></Field>
          </div>
          <div className="row2">
            <Field label={t('nationality')}><Input value={form.nationality || ''} onChange={set('nationality')} placeholder={lang === 'ar' ? 'سعودي' : 'Saudi'} /></Field>
            <Field label={t('gender')}>
              <Select value={form.gender || ''} onChange={set('gender')} options={[
                { value: '', label: '—' },
                { value: 'male', label: t('male') },
                { value: 'female', label: t('female') },
              ]} />
            </Field>
          </div>
          <div className="row2">
            <Field label={t('bloodType')}>
              <Select value={form.bloodType || ''} onChange={set('bloodType')} options={[''].concat(['A+','A-','B+','B-','AB+','AB-','O+','O-']).map(v => ({ value: v, label: v || '—' }))} />
            </Field>
            <Field label={t('maritalStatus')}>
              <Select value={form.maritalStatus || ''} onChange={set('maritalStatus')} options={[
                { value: '', label: '—' },
                { value: 'single', label: t('single') },
                { value: 'married', label: t('married') },
              ]} />
            </Field>
          </div>
        </Card>

        {/* Contact */}
        <Section title={t('contactInfo')} />
        <Card className="stack">
          <div className="row2">
            <Field label={t('mobile')}><Input type="tel" value={form.mobile || ''} onChange={set('mobile')} placeholder="+9665xxxxxxxx" /></Field>
            <Field label={t('altPhone')}><Input type="tel" value={form.altPhone || ''} onChange={set('altPhone')} /></Field>
          </div>
          <Field label={t('email')}><Input type="email" value={form.email || ''} onChange={set('email')} placeholder="name@example.com" /></Field>
        </Card>

        {/* Saudi National Address */}
        <Section title={t('nationalAddress')} />
        <Card className="stack">
          <p className="hint" style={{ margin: '0 2px' }}>{t('nationalAddressHint')}</p>
          <Field label={t('shortAddress')} hint="e.g. RRRD2929"><Input value={form.shortAddress || ''} onChange={set('shortAddress')} style={{ textTransform: 'uppercase' }} placeholder="RRRD2929" /></Field>
          <div className="row2">
            <Field label={t('buildingNo')}><Input inputMode="numeric" value={form.buildingNo || ''} onChange={set('buildingNo')} placeholder="1234" /></Field>
            <Field label={t('secondaryNo')}><Input inputMode="numeric" value={form.secondaryNo || ''} onChange={set('secondaryNo')} placeholder="5678" /></Field>
          </div>
          <Field label={t('street')}><Input value={form.street || ''} onChange={set('street')} /></Field>
          <div className="row2">
            <Field label={t('district')}><Input value={form.district || ''} onChange={set('district')} /></Field>
            <Field label={t('city')}><Input value={form.city || ''} onChange={set('city')} placeholder={lang === 'ar' ? 'الرياض' : 'Riyadh'} /></Field>
          </div>
          <div className="row2">
            <Field label={t('postalCode')}><Input inputMode="numeric" value={form.postalCode || ''} onChange={set('postalCode')} placeholder="12345" /></Field>
            <Field label={t('additionalNo')}><Input inputMode="numeric" value={form.additionalNo || ''} onChange={set('additionalNo')} placeholder="1234" /></Field>
          </div>
          <Button block icon="share" onClick={shareAddress}>{t('shareAddress')}</Button>
        </Card>

        {/* Work */}
        <Section title={t('workInfo')} />
        <Card className="stack">
          <div className="row2">
            <Field label={t('jobTitle')}><Input value={form.jobTitle || ''} onChange={set('jobTitle')} /></Field>
            <Field label={t('company')}><Input value={form.company || ''} onChange={set('company')} /></Field>
          </div>
          <Field label={t('employeeId')}><Input value={form.employeeId || ''} onChange={set('employeeId')} /></Field>
        </Card>

        {/* Emergency contact */}
        <Section title={t('emergencyContact')} />
        <Card className="stack">
          <div className="row2">
            <Field label={t('name')}><Input value={form.emergencyName || ''} onChange={set('emergencyName')} /></Field>
            <Field label={t('relationship')}><Input value={form.emergencyRelation || ''} onChange={set('emergencyRelation')} /></Field>
          </div>
          <Field label={t('mobile')}><Input type="tel" value={form.emergencyPhone || ''} onChange={set('emergencyPhone')} /></Field>
        </Card>

        <p className="center muted" style={{ marginTop: 20, fontSize: 12 }}>{t('profileStoredLocally')}</p>
      </div>
      {photo.node}
      {toast.node}
    </>
  )
}
