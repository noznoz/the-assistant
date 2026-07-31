import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Sheet, Field, Input, TextArea, Select, Button, Chip, Empty, Fab, Segmented, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { WISH_CATEGORIES, WISH_PRIORITIES, findWishCategory, findWishPriority, label } from '../../lib/domain.js'
import { money, toSar, fmtDate } from '../../lib/format.js'
import { makeThumb } from '../../lib/files.js'
import { share } from '../../lib/share.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const CUR = ['SAR', 'USD', 'EUR', 'AED', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR']
const prioRank = { must: 0, want: 1, someday: 2 }

export default function WishlistScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const wishlist = useCollection('wishlist')
  const expenses = useCollection('expenses')
  const [editor, setEditor] = useState(null)
  const [filter, setFilter] = useState('open')   // open | bought
  const toast = useToast()

  const items = wishlist.items.slice().sort((a, b) =>
    (prioRank[a.priority] ?? 3) - (prioRank[b.priority] ?? 3))
  const open = items.filter(x => !x.purchased)
  const bought = items.filter(x => x.purchased)
  const shown = filter === 'bought' ? bought : open

  const openTotal = open.reduce((s, x) => s + toSar(x.price || 0, x.currency || cur, rates), 0)

  const markBought = (x) => {
    wishlist.save({ ...x, purchased: !x.purchased })
    toast.show(x.purchased ? t('savedToast') : t('markedBought'))
  }

  const shareList = () => {
    const lines = [`🎁 *${t('wishlist')}*`, '']
    open.forEach(x => {
      const p = findWishPriority(x.priority)
      lines.push(`• ${x.name}${x.price ? ` — ${money(x.price, x.currency || cur, lang)}` : ''}${p ? ` (${label(p, lang)})` : ''}`)
      if (x.url) lines.push(`  ${x.url}`)
    })
    lines.push('', '— The Assistant')
    share(lines.join('\n'), t('wishlist'))
  }

  return (
    <>
      <DetailHeader title={t('wishlist')} onBack={() => go('more')}
        right={open.length > 0 ? <button className="iconbtn" aria-label={t('share')} onClick={shareList}><Icon name="whatsapp" size={18} /></button> : null} />
      <div className="screen">
        {items.length === 0 ? (
          <Empty icon="gift" title={t('wishlistEmpty')} text={t('wishlistHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addWish')}</Button>} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <Stat label={t('estimatedTotal')} value={money(openTotal, cur, lang)} />
              <Stat label={t('itemsWanted')} value={String(open.length)} />
            </div>

            {bought.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Segmented value={filter} onChange={setFilter} options={[
                  { value: 'open', label: `${t('wanted')} (${open.length})` },
                  { value: 'bought', label: `${t('bought')} (${bought.length})` },
                ]} />
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              {shown.map(x => {
                const c = findWishCategory(x.category)
                const p = findWishPriority(x.priority)
                return (
                  <SwipeRow key={x.id} onEdit={() => setEditor(x)} onDelete={() => { wishlist.remove(x.id); toast.show(t('deletedToast')) }}>
                    <div className="li" onClick={() => setEditor(x)}>
                      <div className="lead" style={{ overflow: 'hidden', padding: x.image ? 0 : undefined }}>
                        {x.image ? <img src={x.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
                          : <span className="t-brand"><Icon name={c?.icon || 'gift'} size={18} /></span>}
                      </div>
                      <div className="body">
                        <div className="title" style={{ textDecoration: x.purchased ? 'line-through' : 'none', opacity: x.purchased ? 0.6 : 1 }}>{x.name}</div>
                        <div className="meta">
                          {p && !x.purchased && <span className={`chip ${p.tint}`} style={{ padding: '1px 7px' }}>{label(p, lang)}</span>}
                          {c && <span>{label(c, lang)}</span>}
                          {x.targetDate && <span>· {fmtDate(x.targetDate, lang, settings.dateFormat)}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'end' }}>
                        {x.price > 0 && <b className="tnum">{money(x.price, x.currency || cur, lang)}</b>}
                        <button className="btn sm" style={{ marginTop: 4, display: 'block' }} onClick={(e) => { e.stopPropagation(); markBought(x) }}>
                          {x.purchased ? t('moveBack') : t('markBought')}
                        </button>
                      </div>
                    </div>
                  </SwipeRow>
                )
              })}
            </div>
          </>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <WishEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

export function WishEditor({ initial, onClose, onSaved }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const wishlist = useCollection('wishlist')
  const [f, setF] = useState({ name: '', category: 'tech', priority: 'want', price: '', currency: settings.currency, url: '', forWho: '', targetDate: '', image: '', note: '', purchased: false, ...initial })
  const [err, setErr] = useState('')
  const imgRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const pickImage = async (fileList) => {
    const file = fileList && fileList[0]
    if (!file) return
    const thumb = await makeThumb(file, 400)
    if (thumb) setF(prev => ({ ...prev, image: thumb }))
  }

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), price: parseFloat(f.price) || 0 }
    initial.id ? wishlist.save({ ...rec, id: initial.id }) : wishlist.add(rec)
    onSaved && onSaved(); onClose()
  }

  return (
    <Sheet title={initial.id ? t('editWish') : t('addWish')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { wishlist.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('wishName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder={t('wishNamePlaceholder')} autoFocus /></Field>
      <div className="row2">
        <Field label={t('category')}><Select value={f.category} onChange={set('category')} options={WISH_CATEGORIES.map(c => ({ value: c.id, label: label(c, lang) }))} /></Field>
        <Field label={t('priority')}><Select value={f.priority} onChange={set('priority')} options={WISH_PRIORITIES.map(p => ({ value: p.id, label: label(p, lang) }))} /></Field>
      </div>
      <div className="row2">
        <Field label={t('estimatedPrice')}><Input type="number" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="0" /></Field>
        <Field label={t('currency')}><Select value={f.currency} onChange={set('currency')} options={CUR.map(c => ({ value: c, label: c }))} /></Field>
      </div>
      <Field label={t('link')} hint={t('optional')}><Input value={f.url} onChange={set('url')} placeholder="https://…" inputMode="url" dir="ltr" /></Field>
      <div className="row2">
        <Field label={t('forWho')} hint={t('optional')}><Input value={f.forWho} onChange={set('forWho')} placeholder={t('forWhoPlaceholder')} /></Field>
        <Field label={t('targetDate')} hint={t('optional')}><Input type="date" value={f.targetDate} onChange={set('targetDate')} /></Field>
      </div>
      <Field label={t('photo')} hint={t('optional')}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {f.image && <img src={f.image} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--line)' }} />}
          <Button icon="upload" onClick={() => imgRef.current?.click()}>{f.image ? t('change') : t('addPhoto')}</Button>
          {f.image && <button className="link-btn" type="button" onClick={() => setF({ ...f, image: '' })}>{t('remove')}</button>}
        </div>
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={e => { pickImage(e.target.files); e.target.value = '' }} />
      </Field>
      <Field label={t('description')}><TextArea value={f.note} onChange={set('note')} placeholder={t('descriptionPlaceholder')} /></Field>
    </Sheet>
  )
}
