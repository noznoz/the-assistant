import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Stat, Bars, Button, Sheet, Field, Input, TextArea, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { catLabel } from '../../lib/domain.js'
import { money, fmtDate, expenseSar } from '../../lib/format.js'
import { share, formatExpenseSummary } from '../../lib/share.js'
import { exportXlsx, printHtml } from '../../lib/exporters.js'
import ExpenseEditor from '../expenses/ExpenseEditor.jsx'

export default function ProjectsScreen({ param, go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const projects = useCollection('projects')
  const expenses = useCollection('expenses')
  const [editor, setEditor] = useState(null)      // project editor
  const toast = useToast()

  const totalFor = (id) => expenses.items.filter(e => e.projectId === id).reduce((s, e) => s + expenseSar(e, settings.rates), 0)

  if (param) {
    const p = projects.items.find(x => x.id === param)
    if (p) return <ProjectDetail project={p} go={go} onBack={() => go('projects')} />
  }

  return (
    <>
      <DetailHeader title={t('projects')} onBack={() => go('expenses')} />
      <div className="screen">
        {projects.items.length === 0 ? (
          <Empty icon="report" title={t('noProjects')} text={t('projectsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newProject')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {projects.items.map(p => {
              const total = totalFor(p.id)
              const budget = Number(p.budget) || 0
              const pct = budget ? Math.min(1, total / budget) : 0
              return (
                <Card key={p.id} className="tight" style={{ marginBottom: 12 }} onClick={() => go(`projects/${p.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="lead t-brand" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="report" size={18} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{money(total, cur, lang)}{budget ? ` / ${money(budget, cur, lang)}` : ''}</div>
                    </div>
                    <Icon name="chevron" size={18} style={{ color: 'var(--ink-3)' }} />
                  </div>
                  {budget > 0 && (
                    <div className="bar-track" style={{ height: 8, marginTop: 10 }}>
                      <div className="bar-fill" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--danger)' : pct > 0.85 ? 'var(--warn)' : 'var(--ok)' }} />
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <ProjectEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function ProjectDetail({ project, go, onBack }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const projects = useCollection('projects')
  const [addExp, setAddExp] = useState(false)
  const [edit, setEdit] = useState(false)
  const toast = useToast()

  const mine = expenses.items.filter(e => e.projectId === project.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const total = mine.reduce((s, e) => s + expenseSar(e, settings.rates), 0)
  const budget = Number(project.budget) || 0
  const pct = budget ? Math.min(1, total / budget) : 0

  const rates = settings.rates
  const byCat = {}
  mine.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expenseSar(e, rates) })
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const bars = catRows.slice(0, 8).map(([id, v]) => ({ label: catLabel(id, lang), value: v }))
  const remaining = budget - total
  const r2 = (n) => Math.round(n * 100) / 100

  const exportExcel = () => {
    const aoa = [
      [project.name],
      [t('budget'), budget || ''],
      [t('projectTotal'), r2(total)],
      [t('remaining'), budget ? r2(remaining) : ''],
      [],
      [t('spendingByCategory'), t('amount') + ' (SAR)'],
      ...catRows.map(([id, v]) => [catLabel(id, lang), r2(v)]),
      [],
      [t('date'), t('item'), t('merchant'), t('category'), t('amount'), t('currency'), 'SAR'],
      ...mine.map(e => [e.date, e.item || '', e.merchant || '', catLabel(e.category, lang), e.amount, e.currency || 'SAR', r2(expenseSar(e, rates))]),
    ]
    exportExcelSafe(project, aoa)
  }
  const exportExcelSafe = async (proj, aoa) => {
    try { await exportXlsx(`${proj.name}.xlsx`, proj.name, aoa, [14, 20, 16, 16, 12, 8, 12]); toast.show(t('savedToast')) }
    catch { toast.show(t('comingSoon')) }
  }
  const exportPdf = () => {
    const rowsHtml = mine.map(e => `<tr><td>${fmtDate(e.date, lang, settings.dateFormat)}</td><td>${escapeHtml(e.item || e.merchant || catLabel(e.category, lang))}</td><td>${escapeHtml(catLabel(e.category, lang))}</td><td class="n">${money(expenseSar(e, rates), cur, lang)}</td></tr>`).join('')
    const catHtml = catRows.map(([id, v]) => `<tr><td>${escapeHtml(catLabel(id, lang))}</td><td class="n">${money(v, cur, lang)}</td></tr>`).join('')
    const body = `
      <h1>${escapeHtml(project.name)}</h1>
      <div class="sub">${t('projectDashboard')} · ${new Date().toLocaleDateString()}</div>
      <div class="total brand">${money(total, cur, lang)}</div>
      <div class="muted">${budget ? `${t('budget')}: ${money(budget, cur, lang)} · ${t('remaining')}: ${money(remaining, cur, lang)}` : ''}</div>
      <h2>${t('spendingByCategory')}</h2>
      <table><thead><tr><th>${t('category')}</th><th class="n">${t('amount')}</th></tr></thead><tbody>${catHtml}</tbody></table>
      <h2>${t('recent')} (${mine.length})</h2>
      <table><thead><tr><th>${t('date')}</th><th>${t('item')}</th><th>${t('category')}</th><th class="n">${t('amount')}</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
    printHtml(project.name, body)
  }

  return (
    <>
      <DetailHeader title={project.name} onBack={onBack} right={
        <button className="iconbtn" onClick={() => setEdit(true)} aria-label={t('edit')}><Icon name="cog" size={18} /></button>
      } />
      <div className="screen">
        <Card style={{ marginTop: 14, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('projectTotal')}</div>
          <div style={{ fontSize: 34, fontWeight: 780, marginTop: 4 }} className="tnum">{money(total, cur, lang)}</div>
          {budget > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="bar-track" style={{ height: 12 }}>
                <div className="bar-fill" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--danger)' : pct > 0.85 ? 'var(--warn)' : 'var(--ok)' }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {money(total, cur, lang)} / {money(budget, cur, lang)}{pct >= 1 ? ` · ${t('overBudget')}` : ''}
              </div>
            </div>
          )}
        </Card>

        <div className="row2" style={{ marginTop: 12 }}>
          <Button variant="primary" icon="plus" onClick={() => setAddExp(true)}>{t('addExpenseTo')}</Button>
          <Button icon="whatsapp" onClick={() => share(`🗂️ *${project.name}*\n\n` + formatExpenseSummary(mine, lang, settings))}>{t('share')}</Button>
        </div>

        <Section title={t('projectDashboard')} />
        <div className="row2">
          <Button icon="download" onClick={exportExcel}>{t('exportExcel')}</Button>
          <Button icon="doc" onClick={exportPdf}>{t('exportPdf')}</Button>
        </div>

        {bars.length > 0 && (
          <>
            <Section title={t('spendingByCategory')} />
            <Card><Bars data={bars} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        <Section title={t('recent')} count={mine.length} />
        {mine.length === 0 ? (
          <Empty icon="wallet" title={t('nothingHere')} text={t('addExpenseTo')} />
        ) : mine.map(e => (
          <div className="li" key={e.id} onClick={() => setAddExp(e)}>
            <div className="lead t-brand"><Icon name="receipt" size={18} /></div>
            <div className="body">
              <div className="title">{e.merchant || catLabel(e.category, lang)}</div>
              <div className="meta">{catLabel(e.category, lang)} · {fmtDate(e.date, lang, settings.dateFormat)}</div>
            </div>
            <b className="tnum">{money(e.amount, e.currency || cur, lang)}</b>
          </div>
        ))}
      </div>

      {addExp && <ExpenseEditor initial={addExp.id ? addExp : { projectId: project.id }} onClose={() => setAddExp(false)} onSaved={() => toast.show(t('savedToast'))} />}
      {edit && <ProjectEditor initial={project} onClose={() => setEdit(false)} onSaved={() => toast.show(t('savedToast'))} onDeleted={onBack} />}
      {toast.node}
    </>
  )
}

function ProjectEditor({ initial, onClose, onSaved, onDeleted }) {
  const { t } = useT()
  const projects = useCollection('projects')
  const [f, setF] = useState({ name: '', budget: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim() }
    initial.id ? projects.save({ ...rec, id: initial.id }) : projects.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('edit') : t('newProject')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { projects.remove(initial.id); onClose(); onDeleted && onDeleted() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('projectName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Summer trip" autoFocus /></Field>
      <Field label={t('budget')} hint={t('optional')}><Input type="number" inputMode="decimal" value={f.budget} onChange={set('budget')} placeholder="0" /></Field>
      <Field label={t('notesField')}><TextArea value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}
