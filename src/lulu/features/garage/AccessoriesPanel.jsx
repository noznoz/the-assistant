import React, { useState, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Section, Sheet, Field, Input, TextArea, Chip, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, fmtDate, todayISO } from '../../lib/format.js'
import { ACCESSORY_STATUSES, accessoryStatus, ACCESSORY_GROUPS, accessoryGroup, accessoryTotal, vehicleTitle, label } from '../../lib/domain.js'
import { makeThumb } from '../../lib/files.js'
import { exportXlsx, printHtml } from '../../lib/exporters.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const groupDef = (id) => ACCESSORY_GROUPS.find(g => g.id === id) || ACCESSORY_GROUPS[0]
const normUrl = (u) => !u ? '' : (/^https?:\/\//i.test(u) ? u : 'https://' + u)
const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Accessories on a vehicle — grouped (accessory / gears / performance / protection),
// each with photo, website, item + shipping + installation costs, installer, and
// a fitted/wishlist status. Filter by group and export a dashboard report.
export default function AccessoriesPanel({ vehicle }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const accessories = useCollection('accessories')
  const [editor, setEditor] = useState(null)
  const [group, setGroup] = useState('all')
  const [report, setReport] = useState(false)
  const toast = useToast()

  const mine = accessories.items.filter(a => a.vehicleId === vehicle.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const fittedTotal = mine.filter(a => accessoryStatus(a) === 'fitted').reduce((s, a) => s + accessoryTotal(a), 0)
  const wishTotal = mine.filter(a => accessoryStatus(a) === 'wishlist').reduce((s, a) => s + accessoryTotal(a), 0)
  const shown = group === 'all' ? mine : mine.filter(a => accessoryGroup(a) === group)
  const groupCount = (id) => mine.filter(a => accessoryGroup(a) === id).length

  return (
    <>
      <Card style={{ textAlign: 'center', marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('accessoriesValue')}</div>
        <div style={{ fontSize: 28, fontWeight: 750, marginTop: 4 }} className="tnum">{money(fittedTotal, cur, lang)}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{mine.filter(a => accessoryStatus(a) === 'fitted').length} {t('fitted').toLowerCase()}{wishTotal > 0 ? ` · ${t('wishlist').toLowerCase()} ${money(wishTotal, cur, lang)}` : ''}</div>
      </Card>

      <div className="row2">
        <Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addAccessory')}</Button>
        <Button icon="report" onClick={() => setReport(true)} disabled={mine.length === 0}>{t('reportLabel')}</Button>
      </div>

      {mine.length === 0 ? (
        <Empty icon="wrench" title={t('noAccessories')} text={t('accessoriesHint')} />
      ) : (
        <>
          <div className="chip-row" style={{ margin: '12px 0 2px' }}>
            <Chip selectable on={group === 'all'} onClick={() => setGroup('all')}>{t('all')} · {mine.length}</Chip>
            {ACCESSORY_GROUPS.map(g => (
              <Chip key={g.id} selectable on={group === g.id} onClick={() => setGroup(g.id)}>
                <Icon name={g.icon} size={12} /> {label(g, lang)}{groupCount(g.id) ? ` · ${groupCount(g.id)}` : ''}
              </Chip>
            ))}
          </div>
          {shown.map(a => {
            const st = accessoryStatus(a)
            const gp = groupDef(accessoryGroup(a))
            const tot = accessoryTotal(a)
            return (
              <SwipeRow key={a.id} onEdit={() => setEditor(a)} onDelete={() => { accessories.remove(a.id); toast.show(t('deletedToast')) }}>
              <div className="li" onClick={() => setEditor(a)}>
                <div className="lead" style={{ padding: 0, overflow: 'hidden', background: 'var(--surface-2)', color: st === 'wishlist' ? 'var(--warn)' : 'var(--brand-600)' }}>
                  {a.photo ? <img src={a.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={gp.icon} size={18} />}
                </div>
                <div className="body">
                  <div className="title">{a.name}</div>
                  <div className="meta">
                    <span className="chip t-brand" style={{ padding: '1px 7px' }}>{label(gp, lang)}</span>
                    <span className={`chip ${st === 'wishlist' ? 't-warn' : 't-ok'}`} style={{ padding: '1px 7px' }}>{label(ACCESSORY_STATUSES.find(x => x.id === st), lang)}</span>
                    {a.brand && <span>· {a.brand}</span>}
                    {a.installedBy && <span>· {a.installedBy}</span>}
                    {a.date && <span>· {fmtDate(a.date, lang, settings.dateFormat)}</span>}
                  </div>
                </div>
                {a.website && <button className="iconbtn" aria-label={t('website')} onClick={(e) => { e.stopPropagation(); window.open(normUrl(a.website), '_blank') }}><Icon name="globe" size={16} /></button>}
                {tot > 0 ? <b className="tnum">{money(tot, cur, lang)}</b> : null}
              </div>
              </SwipeRow>
            )
          })}
        </>
      )}
      {editor && <AccessoryEditor initial={editor.id ? editor : {}} vehicleId={vehicle.id} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {report && <ReportSheet vehicle={vehicle} accessories={mine} onClose={() => setReport(false)} onToast={toast.show} />}
      {toast.node}
    </>
  )
}

function AccessoryEditor({ initial, vehicleId, onClose, onSaved }) {
  const { t, lang } = useT()
  const accessories = useCollection('accessories')
  const [f, setF] = useState({
    name: '', brand: '', group: accessoryGroup(initial), cost: '', shipping: '', install: '',
    purchasedBy: '', installedBy: '',
    website: '', photo: '', date: todayISO(), note: '', status: accessoryStatus(initial), vehicleId, ...initial,
  })
  const status = f.status || 'fitted'
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const cameraRef = useRef(); const fileRef = useRef()
  const pickPhoto = async (fileList) => { const file = fileList && fileList[0]; if (!file) return; const thumb = await makeThumb(file, 480); if (thumb) setF(prev => ({ ...prev, photo: thumb })) }
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = {
      ...f, name: f.name.trim(), status, fitted: status === 'fitted',
      cost: parseFloat(f.cost) || 0, shipping: parseFloat(f.shipping) || 0, install: parseFloat(f.install) || 0,
    }
    initial.id ? accessories.save({ ...rec, id: initial.id }) : accessories.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('editAccessory') : t('addAccessory')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { accessories.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>

      {/* Photo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', border: '1px solid var(--line)', flexShrink: 0 }}>
          {f.photo ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={22} style={{ color: 'var(--ink-3)' }} />}
        </div>
        <div className="stack" style={{ flex: 1 }}>
          <div className="row2">
            <Button size="sm" icon="camera" onClick={() => cameraRef.current?.click()}>{t('takePhoto')}</Button>
            <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()}>{t('photo')}</Button>
          </div>
          {f.photo && <Button size="sm" variant="danger" icon="trash" onClick={() => setF({ ...f, photo: '' })}>{t('delete')}</Button>}
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickPhoto(e.target.files); e.target.value = '' }} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files); e.target.value = '' }} />
      </div>

      <Field label={t('accessoryName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Roof rack, dash cam…" autoFocus /></Field>
      <Field label={t('brand')}><Input value={f.brand} onChange={set('brand')} placeholder="Thule, GoPro…" /></Field>
      <Field label={t('group')}>
        <div className="chip-row">
          {ACCESSORY_GROUPS.map(g => (
            <Chip key={g.id} selectable on={f.group === g.id} onClick={() => setF({ ...f, group: g.id })}><Icon name={g.icon} size={13} /> {label(g, lang)}</Chip>
          ))}
        </div>
      </Field>
      <Field label={t('status')}>
        <div className="chip-row">
          {ACCESSORY_STATUSES.map(s => (
            <Chip key={s.id} selectable on={status === s.id} onClick={() => setF({ ...f, status: s.id })}><Icon name={s.id === 'wishlist' ? 'gift' : 'wrench'} size={13} /> {label(s, lang)}</Chip>
          ))}
        </div>
      </Field>

      <div className="row2">
        <Field label={t('itemCost')}><Input type="number" inputMode="decimal" value={f.cost} onChange={set('cost')} placeholder="0" /></Field>
        <Field label={t('shippingCost')}><Input type="number" inputMode="decimal" value={f.shipping} onChange={set('shipping')} placeholder="0" /></Field>
      </div>
      <Field label={t('installationCost')}><Input type="number" inputMode="decimal" value={f.install} onChange={set('install')} placeholder="0" /></Field>
      <div className="row2">
        <Field label={t('purchasedBy')}><Input value={f.purchasedBy} onChange={set('purchasedBy')} placeholder={t('purchasedByPlaceholder')} /></Field>
        <Field label={t('installedBy')}><Input value={f.installedBy} onChange={set('installedBy')} placeholder={t('installedByPlaceholder')} /></Field>
      </div>
      <Field label={t('website')}><Input value={f.website} onChange={set('website')} inputMode="url" placeholder="https://…" /></Field>
      <Field label={t('date')}><Input type="date" value={f.date} onChange={set('date')} /></Field>
      <Field label={t('notesField')}><TextArea value={f.note} onChange={set('note')} /></Field>
      {accessoryTotal(f) > 0 && <p className="hint" style={{ margin: '0 2px' }}>{t('total')}: {money(accessoryTotal(f), undefined, lang)}</p>}
    </Sheet>
  )
}

// Dashboard report: pick which groups to include, then export to Excel or PDF.
function ReportSheet({ vehicle, accessories, onClose, onToast }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const [sel, setSel] = useState(ACCESSORY_GROUPS.map(g => g.id))
  const toggle = (id) => setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const rows = accessories.filter(a => sel.includes(accessoryGroup(a)))
  const grand = rows.reduce((s, a) => s + accessoryTotal(a), 0)
  const byGroup = ACCESSORY_GROUPS.filter(g => sel.includes(g.id)).map(g => {
    const items = rows.filter(a => accessoryGroup(a) === g.id)
    return { g, count: items.length, total: items.reduce((s, a) => s + accessoryTotal(a), 0) }
  })
  const title = `${vehicleTitle(vehicle)} — ${t('accessories')}`
  const r2 = (n) => Math.round(n * 100) / 100

  const exportExcel = async () => {
    const aoa = [
      [title], [t('generated'), new Date().toLocaleDateString()], [],
      [t('group'), t('items'), t('total') + ' (SAR)'],
      ...byGroup.map(b => [label(b.g, lang), b.count, r2(b.total)]),
      [t('total'), rows.length, r2(grand)], [],
      [t('accessoryName'), t('brand'), t('group'), t('status'), t('itemCost'), t('shippingCost'), t('installationCost'), t('total'), t('purchasedBy'), t('installedBy'), t('website'), t('date')],
      ...rows.map(a => [a.name, a.brand || '', label(groupDef(accessoryGroup(a)), lang), label(ACCESSORY_STATUSES.find(s => s.id === accessoryStatus(a)), lang), Number(a.cost) || 0, Number(a.shipping) || 0, Number(a.install) || 0, r2(accessoryTotal(a)), a.purchasedBy || '', a.installedBy || '', a.website || '', a.date || '']),
    ]
    try { await exportXlsx(`${title}.xlsx`, t('accessories'), aoa, [26, 16, 14, 10, 12, 12, 14, 12, 18, 18, 26, 12]); onToast && onToast(t('savedToast')) }
    catch { onToast && onToast(t('comingSoon')) }
  }
  const exportPdf = () => {
    const gRows = byGroup.map(b => `<tr><td>${escapeHtml(label(b.g, lang))}</td><td class="n">${b.count}</td><td class="n">${money(b.total, cur, lang)}</td></tr>`).join('')
    const dRows = rows.map(a => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.brand || '')}</td><td>${escapeHtml(label(groupDef(accessoryGroup(a)), lang))}</td><td>${escapeHtml(label(ACCESSORY_STATUSES.find(s => s.id === accessoryStatus(a)), lang))}</td><td class="n">${money(accessoryTotal(a), cur, lang)}</td><td>${escapeHtml(a.purchasedBy || '')}</td><td>${escapeHtml(a.installedBy || '')}</td></tr>`).join('')
    const body = `
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">${escapeHtml(t('accessoriesReport'))} · ${new Date().toLocaleDateString()}</div>
      <div class="total brand">${money(grand, cur, lang)}</div>
      <div class="muted">${rows.length} ${escapeHtml(t('items'))}</div>
      <h2>${escapeHtml(t('byGroup'))}</h2>
      <table><thead><tr><th>${escapeHtml(t('group'))}</th><th class="n">${escapeHtml(t('items'))}</th><th class="n">${escapeHtml(t('total'))}</th></tr></thead><tbody>${gRows}</tbody></table>
      <h2>${escapeHtml(t('accessories'))} (${rows.length})</h2>
      <table><thead><tr><th>${escapeHtml(t('accessoryName'))}</th><th>${escapeHtml(t('brand'))}</th><th>${escapeHtml(t('group'))}</th><th>${escapeHtml(t('status'))}</th><th class="n">${escapeHtml(t('total'))}</th><th>${escapeHtml(t('purchasedBy'))}</th><th>${escapeHtml(t('installedBy'))}</th></tr></thead><tbody>${dRows}</tbody></table>`
    printHtml(title, body)
  }

  return (
    <Sheet title={t('accessoriesReport')} onClose={onClose}
      footer={<div className="row2">
        <Button icon="download" onClick={exportExcel} disabled={!rows.length}>{t('exportExcel')}</Button>
        <Button icon="doc" onClick={exportPdf} disabled={!rows.length}>{t('exportPdf')}</Button>
      </div>}>
      <p className="hint" style={{ margin: '0 2px 8px' }}>{t('reportGroupsHint')}</p>
      <div className="chip-row" style={{ marginBottom: 14 }}>
        {ACCESSORY_GROUPS.map(g => (
          <Chip key={g.id} selectable on={sel.includes(g.id)} onClick={() => toggle(g.id)}>
            {sel.includes(g.id) && <Icon name="check" size={12} stroke={3} />} {label(g, lang)}
          </Chip>
        ))}
      </div>

      {/* Live dashboard preview */}
      <Card style={{ textAlign: 'center', marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{t('total')}</div>
        <div style={{ fontSize: 28, fontWeight: 780, marginTop: 4 }} className="tnum">{money(grand, cur, lang)}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{rows.length} {t('items')}</div>
      </Card>
      <Card tight>
        {byGroup.map(b => (
          <div className="li" key={b.g.id} style={{ margin: 0 }}>
            <div className="lead t-brand"><Icon name={b.g.icon} size={17} /></div>
            <div className="body"><div className="title">{label(b.g, lang)}</div><div className="meta">{b.count} {t('items')}</div></div>
            <b className="tnum">{money(b.total, cur, lang)}</b>
          </div>
        ))}
        {byGroup.length === 0 && <div className="muted center" style={{ padding: 14 }}>{t('reportGroupsHint')}</div>}
      </Card>
    </Sheet>
  )
}
