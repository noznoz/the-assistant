import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Bars, Sheet, Field, Input, Select, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { catLabel } from '../../lib/domain.js'
import { fmtDate, money, isoDate, expenseSar } from '../../lib/format.js'
import { share, formatExpenseSummary } from '../../lib/share.js'
import { exportXlsx, printHtml } from '../../lib/exporters.js'
import ExpenseEditor from '../expenses/ExpenseEditor.jsx'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function TripsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const trips = useCollection('trips')
  const vehicles = useCollection('vehicles')
  const expenses = useCollection('expenses')
  const [editor, setEditor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const toast = useToast()

  const current = viewing && trips.items.find(x => x.id === viewing.id)
  if (current) return <TripDetail trip={current} onBack={() => setViewing(null)} />

  const spentFor = (id) => expenses.items.filter(e => e.tripId === id).reduce((s, e) => s + expenseSar(e, settings.rates), 0)

  return (
    <>
      <DetailHeader title={t('trips')} onBack={() => go('more')} />
      <div className="screen">
        {trips.items.length === 0 ? (
          <Empty icon="trip" title={t('nothingHere')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('add')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {trips.items.map(tr => {
              const spent = spentFor(tr.id)
              const budget = Number(tr.budget) || 0
              const pct = budget ? Math.min(1, spent / budget) : 0
              return (
                <SwipeRow key={tr.id} onEdit={() => setEditor(tr)} onDelete={() => { trips.remove(tr.id); toast.show(t('deletedToast')) }}>
                <Card className="tight" onClick={() => setViewing(tr)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="lead t-brand" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="trip" size={18} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{tr.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{tr.destination}{tr.start ? ` · ${fmtDate(tr.start, lang, settings.dateFormat)}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <b className="tnum">{money(spent, cur, lang)}</b>
                      {budget > 0 && <div className="muted" style={{ fontSize: 11 }}>/ {money(budget, cur, lang)}</div>}
                    </div>
                  </div>
                  {budget > 0 && (
                    <div className="bar-track" style={{ height: 8, marginTop: 10 }}>
                      <div className="bar-fill" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--danger)' : pct > 0.85 ? 'var(--warn)' : 'var(--ok)' }} />
                    </div>
                  )}
                </Card>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <TripEditor initial={editor.id ? editor : {}} vehicles={vehicles.items} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function TripDetail({ trip, onBack }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const trips = useCollection('trips')
  const vehicles = useCollection('vehicles')
  const [addExp, setAddExp] = useState(false)
  const [edit, setEdit] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const toast = useToast()

  const mine = expenses.items.filter(e => e.tripId === trip.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const total = mine.reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const budget = Number(trip.budget) || 0
  const pct = budget ? Math.min(1, total / budget) : 0
  const byCat = {}; mine.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, settings.rates) })
  const bars = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => ({ label: catLabel(id, lang), value: v }))
  const veh = vehicles.items.find(v => v.id === trip.vehicleId)

  const doExcel = async () => {
    const aoa = [['The Assistant — ' + t('tripReport')], [t('trips'), trip.name], [t('projectTotal'), total, cur], [],
      ['Date', 'Amount', 'Currency', 'Category', 'Merchant', 'Note'],
      ...mine.slice().reverse().map(e => [e.date || '', +e.amount || 0, e.currency || cur, catLabel(e.category, lang), e.merchant || '', (e.note || '').replace(/\n/g, ' ')])]
    try { await exportXlsx(`trip-${isoDate(new Date())}.xlsx`, trip.name, aoa, [13, 10, 8, 18, 18, 24]); toast.show(t('downloadedToast')) } catch { toast.show('…') }
    setExportOpen(false)
  }
  const doPdf = () => {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const rows = mine.slice().reverse().map(e => `<tr><td>${esc(fmtDate(e.date, lang, settings.dateFormat))}</td><td>${esc(e.merchant || catLabel(e.category, lang))}</td><td>${esc(catLabel(e.category, lang))}</td><td class="n">${esc(money(e.amount, e.currency || cur, lang))}</td></tr>`).join('')
    printHtml(t('tripReport'), `<h1 class="brand">${esc(trip.name)}</h1><div class="sub">${esc(trip.destination || '')}</div><div class="total">${esc(money(total, cur, lang))}</div>
      <table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('merchant'))}</th><th>${esc(t('category'))}</th><th class="n">${esc(t('amount'))}</th></tr></thead><tbody>${rows}</tbody></table>`)
    setExportOpen(false)
  }

  return (
    <>
      <DetailHeader title={trip.name} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEdit(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{[trip.destination, veh?.name].filter(Boolean).join(' · ') || t('tripExpenses')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }} className="tnum">{money(total, cur, lang)}</div>
          {budget > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="bar-track" style={{ height: 12 }}><div className="bar-fill" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--danger)' : pct > 0.85 ? 'var(--warn)' : 'var(--ok)' }} /></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{money(total, cur, lang)} / {money(budget, cur, lang)}{pct >= 1 ? ` · ${t('overBudget')}` : ''}</div>
            </div>
          )}
        </Card>

        <div className="row2" style={{ marginTop: 12 }}>
          <Button variant="primary" icon="plus" onClick={() => setAddExp(true)}>{t('addExpenseTo')}</Button>
          <Button icon="download" onClick={() => setExportOpen(true)}>{t('exportLabel')}</Button>
        </div>

        {bars.length > 0 && (<><Section title={t('spendingByCategory')} /><Card><Bars data={bars} format={(v) => money(v, cur, lang)} /></Card></>)}

        <Section title={t('tripExpenses')} count={mine.length} />
        {mine.length === 0 ? <Empty icon="wallet" title={t('nothingHere')} text={t('addExpenseTo')} /> :
          mine.map(e => (
            <SwipeRow key={e.id} onEdit={() => setAddExp(e)} onDelete={() => { expenses.remove(e.id); toast.show(t('deletedToast')) }}>
            <div className="li" onClick={() => setAddExp(e)}>
              <div className="lead t-brand"><Icon name="receipt" size={18} /></div>
              <div className="body"><div className="title">{e.merchant || catLabel(e.category, lang)}</div><div className="meta">{catLabel(e.category, lang)} · {fmtDate(e.date, lang, settings.dateFormat)}</div></div>
              <b className="tnum">{money(e.amount, e.currency || cur, lang)}</b>
            </div>
            </SwipeRow>
          ))}

        <Button block variant="brand" icon="whatsapp" style={{ marginTop: 16 }} onClick={() => share(`🧭 *${trip.name}*\n\n` + formatExpenseSummary(mine, lang, settings))}>{t('share')}</Button>
      </div>

      {addExp && <ExpenseEditor initial={addExp.id ? addExp : { tripId: trip.id }} onClose={() => setAddExp(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {edit && <TripEditor initial={trip} vehicles={vehicles.items} onClose={() => setEdit(false)} onSaved={() => toast.show(t('savedToast'))} onDeleted={onBack} />}
      {exportOpen && (
        <Sheet title={t('exportLabel')} onClose={() => setExportOpen(false)}>
          <div className="stack">
            <Button block icon="chart" onClick={doExcel}>{t('exportExcel')}</Button>
            <Button block icon="doc" onClick={doPdf}>{t('exportPdf')}</Button>
          </div>
        </Sheet>
      )}
      {toast.node}
    </>
  )
}

function TripEditor({ initial, vehicles, onClose, onSaved, onDeleted }) {
  const { t } = useT()
  const trips = useCollection('trips')
  const [f, setF] = useState({ name: '', destination: '', start: '', end: '', vehicleId: '', budget: '', notes: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => { if (!f.name.trim()) return; initial.id ? trips.save({ ...f, id: initial.id }) : trips.add(f); onSaved && onSaved(); onClose() }
  return (
    <Sheet title={initial.id ? t('edit') : t('trips')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { trips.remove(initial.id); onClose(); onDeleted && onDeleted() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('title')} required><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label="Destination"><Input value={f.destination} onChange={set('destination')} placeholder="Destination" /></Field>
      <div className="row2">
        <Field label="Start"><Input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="End"><Input type="date" value={f.end} onChange={set('end')} /></Field>
      </div>
      <Field label={t('tripBudget')} hint={t('optional')}><Input type="number" inputMode="decimal" value={f.budget} onChange={set('budget')} placeholder="0" /></Field>
      {vehicles.length > 0 && (
        <Field label={t('relatedVehicle')}>
          <Select value={f.vehicleId} onChange={set('vehicleId')}>
            <option value="">{t('none')}</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t('notesField')}><Input value={f.notes} onChange={set('notes')} /></Field>
    </Sheet>
  )
}
