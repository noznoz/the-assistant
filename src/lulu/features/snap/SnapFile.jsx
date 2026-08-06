import React, { useState, useRef, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Sheet, Button, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { requestClaude } from '../../lib/ai.js'
import { makeThumb, imageToDataURL } from '../../lib/files.js'
import { uid } from '../../store/db.js'
import { todayISO } from '../../lib/format.js'
import ExpenseEditor from '../expenses/ExpenseEditor.jsx'
import { DocEditor } from '../documents/DocumentsScreen.jsx'

// Valid target categories (must match domain.js) so we never feed an editor a
// category it doesn't know.
const EXP_CATS = new Set(['fuel', 'dining', 'groceries', 'shopping', 'hotels', 'entertainment', 'household', 'vehicle_maint', 'utilities', 'other'])
const DOC_CATS = new Set(['id', 'work', 'vehicle_reg', 'insurance', 'invoice', 'warranty', 'travel', 'financial', 'contract', 'medical', 'property', 'education', 'personal', 'other'])
const CURRENCIES = new Set(['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR'])
const ISO = /^\d{4}-\d{2}-\d{2}$/

function resolveVehicle(vehicles, name) {
  if (!name) return null
  const n = String(name).trim().toLowerCase()
  const list = vehicles || []
  return list.find(v => (v.nickname || '').toLowerCase() === n || (v.name || '').toLowerCase() === n)
    || list.find(v => [v.nickname, v.name, v.plate].filter(Boolean)
      .some(s => { const x = String(s).toLowerCase(); return x && (x.includes(n) || n.includes(x)) }))
    || null
}
function resolvePerson(people, name) {
  if (!name) return null
  const n = String(name).trim().toLowerCase()
  const list = people || []
  return list.find(p => (p.name || '').toLowerCase() === n)
    || list.find(p => { const x = (p.name || '').toLowerCase(); return x && (x.includes(n) || n.includes(x)) })
    || null
}

// Ask Claude vision to classify the photo and pull out the key fields.
async function analyzePhoto(file, { apiKey, model, vehicles, people, currency }) {
  const dataUrl = await imageToDataURL(file, 1280, 0.8)
  const base64 = (dataUrl || '').split(',')[1]
  if (!base64) throw new Error('image')
  const vehNames = (vehicles || []).map(v => v.nickname || v.name).filter(Boolean).join(', ')
  const personNames = (people || []).map(p => p.name).filter(Boolean).join(', ')
  const system = `You extract structured data from a photo of a document or a receipt. Respond with ONLY a compact JSON object — no prose, no markdown fences.
Schema:
{"kind":"document|expense","title":string,"docType":"id|work|vehicle_reg|insurance|invoice|warranty|travel|financial|contract|medical|property|education|personal|other","expiry":"YYYY-MM-DD|null","date":"YYYY-MM-DD|null","amount":number|null,"currency":"ISO code|null","category":"fuel|dining|groceries|shopping|hotels|entertainment|household|vehicle_maint|utilities|other|null","merchant":string|null,"vehicle":string|null,"person":string|null}
Rules: kind="expense" for receipts, invoices and bills to record as spending; kind="document" for IDs, passports, licenses, vehicle registrations, insurance policies, contracts, warranties and certificates. Use null for anything not clearly visible. All dates ISO YYYY-MM-DD. Never invent an amount.`
  const hint = `Known vehicles: ${vehNames || 'none'}. Known people: ${personNames || 'none'}. Default currency: ${currency}. If the item clearly relates to one of these, put the matching name in "vehicle" or "person".`
  const res = await requestClaude({
    apiKey, model, system, maxTokens: 700,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: hint },
      ],
    }],
  })
  const txt = (res.text || '').trim()
  const m = txt.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('parse')
  return JSON.parse(m[0])
}

export default function SnapFile({ onClose, onSaved }) {
  const { t } = useT()
  const { settings } = useSettings()
  const vehicles = useCollection('vehicles')
  const people = useCollection('people')
  const [phase, setPhase] = useState('idle') // idle | reading | error | expense | document
  const [prefill, setPrefill] = useState(null)
  const [thumbRec, setThumbRec] = useState(null)
  const camRef = useRef()

  const hasKey = !!settings.anthropicKey

  // Auto-open the camera as soon as the sheet appears.
  useEffect(() => { if (hasKey) camRef.current?.click() }, [hasKey])

  const thumbRecordFor = async (file) => ({
    id: uid(),
    name: `snap-${todayISO()}.jpg`,
    type: 'image/jpeg',
    size: 0,
    thumb: await makeThumb(file),
    addedAt: new Date().toISOString(),
    snapOnly: true, // only a thumbnail is kept — no full-resolution file stored
  })

  const onPhoto = async (file) => {
    if (!file || !/^image\//.test(file.type)) return
    setPhase('reading')
    const thumb = await thumbRecordFor(file)
    setThumbRec(thumb)
    try {
      const x = await analyzePhoto(file, {
        apiKey: settings.anthropicKey, model: settings.aiModel,
        vehicles: vehicles.items, people: people.items, currency: settings.currency,
      })
      const veh = resolveVehicle(vehicles.items, x.vehicle)
      if (x.kind === 'expense') {
        setPrefill({
          amount: x.amount != null ? String(x.amount) : '',
          currency: CURRENCIES.has(x.currency) ? x.currency : settings.currency,
          category: EXP_CATS.has(x.category) ? x.category : 'other',
          merchant: x.merchant || '',
          date: ISO.test(x.date || '') ? x.date : todayISO(),
          ...(veh ? { relatedVehicle: veh.id } : {}),
          receipts: [thumb],
        })
        setPhase('expense')
      } else {
        const person = resolvePerson(people.items, x.person)
        setPrefill({
          title: x.title || '',
          category: DOC_CATS.has(x.docType) ? x.docType : 'other',
          expiry: ISO.test(x.expiry || '') ? x.expiry : '',
          attachments: [thumb],
          ...(veh ? { vehicleId: veh.id } : person ? { personId: person.id } : {}),
        })
        setPhase('document')
      }
    } catch {
      // Reading failed — keep the thumbnail so the user can still file it manually.
      setPhase('error')
    }
  }

  // From the error state, file manually with just the thumbnail attached.
  const fileAs = (kind) => {
    setPrefill(kind === 'expense' ? { receipts: [thumbRec] } : { attachments: [thumbRec] })
    setPhase(kind)
  }

  if (phase === 'expense') {
    return <ExpenseEditor initial={prefill} onClose={onClose} onSaved={onSaved} />
  }
  if (phase === 'document') {
    return <DocEditor initial={prefill} onClose={onClose} onSaved={onSaved} onToast={() => {}} />
  }

  return (
    <Sheet title={t('snapFile')} onClose={onClose}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { onPhoto(e.target.files && e.target.files[0]); e.target.value = '' }} />

      {!hasKey ? (
        <Empty icon="camera" title={t('snapFile')} text={t('snapNeedsKey')} />
      ) : phase === 'reading' ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 12, padding: '40px 0' }}>
          <span className="spinner" style={{ width: 30, height: 30 }} />
          <p className="muted" style={{ fontWeight: 600 }}>{t('snapReading')}</p>
        </div>
      ) : phase === 'error' ? (
        <div style={{ padding: '10px 0' }}>
          <Empty icon="camera" title={t('snapFailed')} text={t('snapFileHint')} />
          <div className="stack" style={{ marginTop: 12 }}>
            <Button block variant="primary" icon="wallet" onClick={() => fileAs('expense')}>{t('snapAsExpense')}</Button>
            <Button block icon="doc" onClick={() => fileAs('document')}>{t('snapAsDocument')}</Button>
            <Button block icon="camera" onClick={() => camRef.current?.click()}>{t('snapRetake')}</Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '6px 0' }}>
          <Empty icon="camera" title={t('snapFile')} text={t('snapFileHint')} />
          <div className="stack" style={{ marginTop: 12 }}>
            <Button block variant="primary" icon="camera" onClick={() => camRef.current?.click()}>{t('scanReceipt')}</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
