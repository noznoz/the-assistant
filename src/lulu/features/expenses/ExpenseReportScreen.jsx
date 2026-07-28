import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Stat, Segmented, Bars, Chip, Field, Input, Select, Button, Sheet, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { catLabel, findPayment, label } from '../../lib/domain.js'
import { money, fmtDate, isoDate } from '../../lib/format.js'
import { share } from '../../lib/share.js'
import { exportXlsx, printHtml } from '../../lib/exporters.js'

export default function ExpenseReportScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const expenses = useCollection('expenses')
  const projects = useCollection('projects')
  const toast = useToast()

  const [mode, setMode] = useState('period')     // 'period' | 'project'
  const [period, setPeriod] = useState('month')  // week | month | year | all | custom
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [projectId, setProjectId] = useState(projects.items[0]?.id || '')
  const [includeProjects, setIncludeProjects] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  const now = new Date()
  const inPeriod = (dateStr) => {
    const d = new Date(isoDate(dateStr))
    if (period === 'week') { const w = new Date(); w.setDate(w.getDate() - 7); return d >= w }
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    if (period === 'all') return true
    if (period === 'custom') {
      if (from && d < new Date(from)) return false
      if (to && d > new Date(to)) return false
      return true
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() // month
  }

  const list = useMemo(() => {
    if (mode === 'project') return expenses.items.filter(e => e.projectId === projectId)
    let l = expenses.items.filter(e => inPeriod(e.date))
    if (!includeProjects) l = l.filter(e => !e.projectId)
    return l
  }, [expenses.items, mode, period, from, to, projectId, includeProjects])

  const total = list.reduce((s, e) => s + (+e.amount || 0), 0)
  const largest = Math.max(0, ...list.map(e => +e.amount || 0))
  const group = (keyFn) => {
    const m = {}
    list.forEach(e => { const k = keyFn(e); if (k != null) m[k] = (m[k] || 0) + (+e.amount || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const byCat = group(e => e.category)
  const byPay = group(e => e.method)
  const byProj = group(e => e.projectId || '__none')
  const work = list.filter(e => e.classification === 'work').reduce((s, e) => s + (+e.amount || 0), 0)
  const personal = total - work
  const reimb = list.filter(e => e.reimbursable && !e.reimbursed).reduce((s, e) => s + (+e.amount || 0), 0)

  const projName = (id) => id === '__none' ? (lang === 'ar' ? 'بدون مشروع' : 'No project') : (projects.items.find(p => p.id === id)?.name || '—')
  const scopeLabel = mode === 'project'
    ? (projects.items.find(p => p.id === projectId)?.name || t('byProject'))
    : period === 'custom' ? `${from || '…'} → ${to || '…'}`
    : period === 'week' ? t('thisWeek') : period === 'year' ? t('thisYear') : period === 'all' ? t('allTime') : t('monthlyTotal')

  const buildShare = () => {
    const lines = [`💳 *${t('expenseReport')}* — ${scopeLabel}`,
      `${lang === 'ar' ? 'الإجمالي' : 'Total'}: *${money(total, cur, lang)}* · ${list.length} ${t('transactionsLabel')}`, '']
    byCat.slice(0, 8).forEach(([id, amt]) => lines.push(`• ${catLabel(id, lang)}: ${money(amt, cur, lang)}`))
    lines.push('', '— The Assistant')
    return lines.join('\n')
  }

  const sorted = () => list.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const doExcel = async () => {
    const aoa = [
      ['The Assistant — ' + t('expenseReport')],
      [t('byPeriod') + ' / ' + t('byProject'), scopeLabel],
      [t('projectTotal'), total, cur],
      [t('transactionsLabel'), list.length],
      [],
      ['Date', 'Amount', 'Currency', 'Category', 'Merchant', 'Payment', 'Project', 'Type', 'Reimbursable', 'Note'],
      ...sorted().map(e => [
        e.date || '', +e.amount || 0, e.currency || cur, catLabel(e.category, lang), e.merchant || '',
        label(findPayment(e.method), lang) || '', projName(e.projectId || '__none'),
        e.classification || '', e.reimbursable ? 'yes' : 'no', (e.note || '').replace(/\n/g, ' '),
      ]),
    ]
    try {
      await exportXlsx(`expense-report-${isoDate(now)}.xlsx`, t('expenseReport'), aoa, [13, 10, 8, 18, 18, 14, 16, 10, 12, 24])
      toast.show(t('downloadedToast'))
    } catch { toast.show('…') }
    setExportOpen(false)
  }

  const doPdf = () => {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const catRows = byCat.slice(0, 12).map(([id, v]) => `<tr><td>${esc(catLabel(id, lang))}</td><td class="n">${esc(money(v, cur, lang))}</td></tr>`).join('')
    const itemRows = sorted().map(e => `<tr>
      <td>${esc(fmtDate(e.date, lang, settings.dateFormat))}</td>
      <td>${esc(e.merchant || catLabel(e.category, lang))}</td>
      <td>${esc(catLabel(e.category, lang))}</td>
      <td>${esc(projName(e.projectId || '__none'))}</td>
      <td class="n">${esc(money(e.amount, e.currency || cur, lang))}</td></tr>`).join('')
    const body = `
      <h1 class="brand">${esc(t('expenseReport'))}</h1>
      <div class="sub">${esc(scopeLabel)}</div>
      <div class="total">${esc(money(total, cur, lang))}</div>
      <div class="muted">${list.length} ${esc(t('transactionsLabel'))} · ${esc(t('work'))} ${esc(money(work, cur, lang))} · ${esc(t('personal'))} ${esc(money(personal, cur, lang))}</div>
      <h2>${esc(t('spendingByCategory'))}</h2>
      <table><tbody>${catRows}</tbody></table>
      <h2>${esc(t('recent'))}</h2>
      <table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('merchant'))}</th><th>${esc(t('category'))}</th><th>${esc(t('project'))}</th><th class="n">${esc(t('amount'))}</th></tr></thead><tbody>${itemRows}</tbody></table>`
    printHtml(t('expenseReport'), body)
    setExportOpen(false)
  }

  return (
    <>
      <DetailHeader title={t('expenseReport')} onBack={() => go('expenses')} right={
        <button className="iconbtn" onClick={() => share(buildShare())} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        {/* Controls */}
        <div style={{ margin: '14px 0 10px' }}>
          <Segmented value={mode} onChange={setMode} options={[
            { value: 'period', label: t('byPeriod') },
            { value: 'project', label: t('byProject') },
          ]} />
        </div>

        {mode === 'period' ? (
          <Card className="stack">
            <div className="chip-row">
              {[['week', t('thisWeek')], ['month', t('monthlyTotal')], ['year', t('thisYear')], ['all', t('allTime')], ['custom', t('customRange')]].map(([id, lbl]) => (
                <Chip key={id} selectable on={period === id} onClick={() => setPeriod(id)}>{lbl}</Chip>
              ))}
            </div>
            {period === 'custom' && (
              <div className="row2">
                <Field label={t('fromDate')}><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
                <Field label={t('toDate')}><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
              </div>
            )}
            <Toggle label={t('includeProjects')} on={includeProjects} onChange={setIncludeProjects} />
          </Card>
        ) : (
          <Card>
            {projects.items.length === 0 ? (
              <p className="muted">{t('noProjects')}</p>
            ) : (
              <Field label={t('selectProject')}>
                <Select value={projectId} onChange={e => setProjectId(e.target.value)}
                  options={projects.items.map(p => ({ value: p.id, label: p.name }))} />
              </Field>
            )}
          </Card>
        )}

        {/* Result */}
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{scopeLabel}</div>
          <div style={{ fontSize: 38, fontWeight: 780, marginTop: 6, letterSpacing: '-0.03em' }} className="tnum">{money(total, cur, lang)}</div>
        </Card>

        <div className="stat-grid" style={{ marginTop: 14 }}>
          <Stat label={t('transactionsLabel')} value={list.length} />
          <Stat label={t('largest')} value={money(largest, cur, lang)} />
          <Stat label={t('work')} value={money(work, cur, lang)} />
          <Stat label={t('personal')} value={money(personal, cur, lang)} />
        </div>
        {reimb > 0 && (
          <Card className="tight" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="lead t-warn" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="wallet" size={18} /></span>
            <span style={{ flex: 1, fontWeight: 600 }}>{t('reimbursableLabel')}</span>
            <b className="tnum">{money(reimb, cur, lang)}</b>
          </Card>
        )}

        {byCat.length > 0 && (
          <>
            <Section title={t('spendingByCategory')} />
            <Card><Bars data={byCat.slice(0, 8).map(([id, v]) => ({ label: catLabel(id, lang), value: v }))} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        {mode === 'period' && includeProjects && byProj.filter(([id]) => id !== '__none').length > 0 && (
          <>
            <Section title={t('byProjectTitle')} />
            <Card><Bars data={byProj.slice(0, 8).map(([id, v]) => ({ label: projName(id), value: v }))} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        {byPay.length > 0 && (
          <>
            <Section title={t('byPayment')} />
            <Card><Bars data={byPay.slice(0, 6).map(([id, v]) => ({ label: label(findPayment(id), lang) || id, value: v }))} format={(v) => money(v, cur, lang)} /></Card>
          </>
        )}

        <div className="row2" style={{ marginTop: 18 }}>
          <Button variant="brand" icon="whatsapp" onClick={() => share(buildShare())}>{t('share')}</Button>
          <Button icon="download" onClick={() => setExportOpen(true)}>{t('exportLabel')}</Button>
        </div>
      </div>

      {exportOpen && (
        <Sheet title={t('exportLabel')} onClose={() => setExportOpen(false)}>
          <p className="muted" style={{ marginBottom: 14 }}>{t('chooseFormat')}</p>
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

function Toggle({ label, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 0, color: 'var(--ink)', padding: 0 }}>
      <Icon name="report" size={18} style={{ color: 'var(--ink-3)' }} />
      <span style={{ flex: 1, textAlign: 'start', fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ width: 46, height: 28, borderRadius: 14, background: on ? 'var(--ok)' : 'var(--line-2)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
      </span>
    </button>
  )
}
