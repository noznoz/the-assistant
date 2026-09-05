import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { whatsappToPerson, personDigits, emailShare, share } from '../../lib/share.js'
import { aiDayBrief } from '../../lib/dayBrief.js'
import * as cloud from '../../lib/cloud.js'

// Shows the morning brief with one-tap send-to-yourself over WhatsApp or email,
// copy, and (when a Claude key is set) an AI rewrite.
export default function DayBriefSheet({ brief, onClose }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const toast = useToast()
  const [text, setText] = useState(brief)
  const [busy, setBusy] = useState(false)

  const profile = settings.profile || {}
  const myEmail = profile.email || (cloud.currentUser() && cloud.currentUser().email) || ''
  const aiOn = settings.aiProvider === 'claude' && !!settings.anthropicKey

  const toWhatsApp = () => {
    const me = { mobile: profile.mobile, whatsapp: profile.whatsapp }
    if (personDigits(me)) whatsappToPerson(me, text)
    else share(text) // no number saved → open the OS share sheet
  }
  const toEmail = () => emailShare(t('yourDayBrief'), text, myEmail)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.show(t('copied')) }
    catch { share(text) }
  }
  const rewrite = async () => {
    setBusy(true)
    try {
      const r = await aiDayBrief(brief, { apiKey: settings.anthropicKey, model: settings.aiModel, lang })
      if (r) { setText(r); toast.show(t('savedToast')) }
      else toast.show(t('testPushError'))
    } finally { setBusy(false) }
  }

  return (
    <Sheet title={t('startMyDay')} onClose={onClose}
      footer={<div className="stack">
        <div className="row2">
          <Button variant="brand" icon="whatsapp" onClick={toWhatsApp}>{t('whatsappMe')}</Button>
          <Button icon="mail" onClick={toEmail}>{t('emailMe')}</Button>
        </div>
        {aiOn && <Button block icon="sparkle" onClick={rewrite} disabled={busy}>{busy ? t('thinking') : t('rewriteAI')}</Button>}
      </div>}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="link-btn" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-600)', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={copy}>
          <Icon name="copy" size={14} /> {t('copy')}
        </button>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-1)', fontFamily: 'inherit' }}>{text}</div>
      {toast.node}
    </Sheet>
  )
}
