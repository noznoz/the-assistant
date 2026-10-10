import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { share } from '../../lib/share.js'
import { aiMoneyReview } from '../../lib/moneyReview.js'

// Shows the month's spending review (deterministic text) with copy, share, and
// — when a Claude key is set — a warm AI rewrite.
export default function MoneyReviewSheet({ review, onClose }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const toast = useToast()
  const [text, setText] = useState(review)
  const [busy, setBusy] = useState(false)
  const aiOn = settings.aiProvider === 'claude' && !!settings.anthropicKey

  const copy = async () => { try { await navigator.clipboard.writeText(text); toast.show(t('copied')) } catch { share(text) } }
  const rewrite = async () => {
    setBusy(true)
    try {
      const r = await aiMoneyReview(review, { apiKey: settings.anthropicKey, model: settings.aiModel, lang })
      if (r) { setText(r); toast.show(t('savedToast')) } else toast.show(t('testPushError'))
    } finally { setBusy(false) }
  }

  return (
    <Sheet title={t('monthlyReview')} onClose={onClose}
      footer={<div className="stack">
        <Button block icon="whatsapp" onClick={() => share(text)}>{t('shareWhatsApp')}</Button>
        {aiOn && <Button block variant="brand" icon="sparkle" onClick={rewrite} disabled={busy}>{busy ? t('thinking') : t('rewriteAI')}</Button>}
      </div>}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="link-btn" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-600)', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={copy}>
          <Icon name="copy" size={14} /> {t('copy')}
        </button>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-1)' }}>{text}</div>
      {toast.node}
    </Sheet>
  )
}
