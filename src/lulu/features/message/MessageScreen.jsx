import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, TextArea, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { RELATIONSHIPS, label } from '../../lib/domain.js'
import { personDigits, whatsappToPerson, shareToWhatsApp } from '../../lib/share.js'

// Compose a message in the app, pick a recipient (from your contacts, from the
// phone's address book where supported, or by typing a number), then hand off
// to WhatsApp pre-filled and ready to send.
export default function MessageScreen({ go }) {
  const { t, lang } = useT()
  const people = useCollection('people')
  const toast = useToast()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)     // { name, digits } | null
  const [manual, setManual] = useState('')

  const contactSupported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window

  const withNumbers = useMemo(
    () => people.items.filter(p => personDigits(p)),
    [people.items]
  )
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? withNumbers.filter(p => (p.name || '').toLowerCase().includes(q)) : withNumbers
    return list.slice(0, 40)
  }, [withNumbers, query])

  const recipient = picked || (manual.replace(/[^0-9]/g, '') ? { name: manual, digits: manual.replace(/[^0-9]/g, '') } : null)

  const pickPhoneContact = async () => {
    try {
      const sel = await navigator.contacts.select(['name', 'tel'], { multiple: false })
      const c = sel && sel[0]
      if (!c) return
      const digits = String((c.tel && c.tel[0]) || '').replace(/[^0-9]/g, '')
      const name = (c.name && c.name[0]) || t('message')
      if (!digits) { toast.show(t('noNumberForContact')); return }
      setPicked({ name, digits }); setManual('')
    } catch { /* user cancelled or unsupported */ }
  }

  const send = () => {
    if (!text.trim()) { toast.show(t('writeMessageFirst')); return }
    if (!recipient) {
      // No recipient chosen — let WhatsApp's own chooser pick one.
      shareToWhatsApp(text.trim()); return
    }
    whatsappToPerson({ whatsapp: recipient.digits }, text.trim())
  }

  return (
    <>
      <DetailHeader title={t('sendMessage')} onBack={() => go('today')} />
      <div className="screen">
        <Section title={t('message')} />
        <Card className="stack">
          <TextArea value={text} onChange={e => setText(e.target.value)} rows={4}
            placeholder={t('writeMessagePlaceholder')} autoFocus style={{ minHeight: 110 }} />
          <div className="chip-row">
            {[t('quickHi'), t('quickFollowUp'), t('quickThanks')].map((q, i) => (
              <button key={i} className="chip" onClick={() => setText(text ? text + ' ' + q : q)}>{q}</button>
            ))}
          </div>
        </Card>

        <Section title={t('to')} />
        {recipient && (
          <Card style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--ok)' }}>
            <span className="lead t-ok" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="whatsapp" size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{recipient.name}</div>
              <div className="muted" style={{ fontSize: 12 }} dir="ltr">+{recipient.digits}</div>
            </div>
            <button className="iconbtn" aria-label={t('clear')} onClick={() => { setPicked(null); setManual('') }}><Icon name="x" size={16} /></button>
          </Card>
        )}

        <Card className="stack" style={{ marginTop: recipient ? 12 : 0 }}>
          {contactSupported && (
            <Button block icon="people" onClick={pickPhoneContact}>{t('chooseFromContacts')}</Button>
          )}
          <Field label={t('orTypeNumber')}>
            <Input type="tel" inputMode="tel" dir="ltr" value={manual}
              onChange={e => { setManual(e.target.value); setPicked(null) }} placeholder="+9665xxxxxxxx" />
          </Field>
        </Card>

        {/* Send */}
        <div style={{ marginTop: 14 }}>
          <Button block variant="brand" icon="whatsapp" onClick={send}>
            {recipient ? `${t('sendVia')} · ${recipient.name}` : t('sendViaWhatsApp')}
          </Button>
        </div>

        <Section title={t('fromMyContacts')} count={withNumbers.length} />
        {withNumbers.length === 0 ? (
          <Empty icon="people" title={t('noContactsYet')} text={t('addFamily')}
            action={<Button variant="primary" icon="plus" onClick={() => go('people')}>{t('people')}</Button>} />
        ) : (
          <>
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchContacts')} style={{ marginBottom: 8 }} />
            <Card tight flat style={{ padding: 6 }}>
              {results.map((p, i) => {
                const rel = RELATIONSHIPS.find(r => r.id === p.relationship)
                const initials = (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                const digits = personDigits(p)
                const on = picked && picked.digits === digits
                return (
                  <button key={p.id} onClick={() => { setPicked({ name: p.name, digits }); setManual('') }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                    background: on ? 'var(--brand-tint)' : 'transparent', border: 0, borderTop: i ? '1px solid var(--line)' : 0,
                    color: 'var(--ink)', borderRadius: on ? 10 : 0,
                  }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--brand-tint)', color: 'var(--brand-600)', fontWeight: 700, display: 'grid', placeItems: 'center', fontSize: 13 }}>
                      {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                    </span>
                    <span style={{ flex: 1, textAlign: 'start', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                      <span className="muted" style={{ display: 'block', fontSize: 12 }}>{[rel ? label(rel, lang) : '', p.jobTitle].filter(Boolean).join(' · ')}</span>
                    </span>
                    {on
                      ? <Icon name="check" size={18} style={{ color: 'var(--ok)' }} />
                      : <Icon name="whatsapp" size={16} style={{ color: 'var(--ok)' }} />}
                  </button>
                )
              })}
            </Card>
          </>
        )}

        <div style={{ height: 24 }} />
      </div>
      {toast.node}
    </>
  )
}
