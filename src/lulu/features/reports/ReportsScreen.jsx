import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Segmented, Stat, Section, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, isToday, isOverdue, daysUntil, expenseSar } from '../../lib/format.js'
import { share } from '../../lib/share.js'

export default function ReportsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const tasks = useCollection('tasks')
  const expenses = useCollection('expenses')
  const vehicles = useCollection('vehicles')
  const [period, setPeriod] = useState('daily')

  const now = new Date()
  const within = (dateStr, days) => { const d = new Date(dateStr); const from = new Date(); from.setDate(from.getDate() - days); return d >= from }
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30

  const r = useMemo(() => {
    const completed = tasks.items.filter(x => x.status === 'completed' && (period === 'daily' ? isToday(x.completedAt || x.updatedAt) : within(x.completedAt || x.updatedAt, days)))
    const open = tasks.items.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
    const overdue = open.filter(x => isOverdue(x.dueDate))
    const delegated = open.filter(x => x.status === 'waiting_someone')
    const exp = expenses.items.filter(e => period === 'daily' ? isToday(e.date) : within(e.date, days))
    const spend = exp.reduce((s, e) => s + expenseSar(e, settings.rates), 0)
    const renewals = vehicles.items.map(v => ({ v, dd: daysUntil(v.policyExpiry) })).filter(x => x.dd != null && x.dd <= 30)
    return { completed, open, overdue, delegated, spend, renewals }
  }, [tasks.items, expenses.items, vehicles.items, period])

  const text = useMemo(() => {
    const title = period === 'daily' ? (lang === 'ar' ? 'المراجعة اليومية' : 'Daily Review') : period === 'weekly' ? (lang === 'ar' ? 'المراجعة الأسبوعية' : 'Weekly Review') : (lang === 'ar' ? 'المراجعة الشهرية' : 'Monthly Review')
    return [
      `📊 *${title}*`, '',
      `✅ ${lang === 'ar' ? 'مكتملة' : 'Completed'}: ${r.completed.length}`,
      `📌 ${lang === 'ar' ? 'مفتوحة' : 'Open'}: ${r.open.length}`,
      `⏰ ${t('overdue')}: ${r.overdue.length}`,
      `👥 ${t('delegated')}: ${r.delegated.length}`,
      `💳 ${lang === 'ar' ? 'الإنفاق' : 'Spending'}: ${money(r.spend, cur, lang)}`,
      r.renewals.length ? `🛡️ ${t('renewals')}: ${r.renewals.length}` : '',
      '', '— The Assistant',
    ].filter(Boolean).join('\n')
  }, [r, period, lang])

  return (
    <>
      <DetailHeader title={t('reports')} onBack={() => go('more')} right={
        <button className="iconbtn" onClick={() => share(text)} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        <button onClick={() => go('boardpack')} style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--brand-tint)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', color: 'var(--ink)' }}>
          <span className="lead t-brand" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="report" size={20} /></span>
          <span style={{ flex: 1, textAlign: 'start' }}>
            <span style={{ display: 'block', fontWeight: 750 }}>{t('boardPack')}</span>
            <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{t('boardPackSub')}</span>
          </span>
          <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
        </button>

        <Section title={t('financialReports')} />
        <div className="qa-grid">
          {[
            { id: 'monthlyreport', icon: 'report', label: t('monthlyReport') },
            { id: 'trends', icon: 'chart', label: t('trends') },
            { id: 'statement', icon: 'doc', label: t('monthlyStatement') },
            { id: 'networth', icon: 'shield', label: t('netWorth') },
            { id: 'zakat', icon: 'sparkle', label: t('zakat') },
            { id: 'expensereport', icon: 'wallet', label: t('expenses') },
          ].map(rp => (
            <button key={rp.id} className="qa" onClick={() => go(rp.id)}>
              <span className="ic"><Icon name={rp.icon} size={22} /></span>{rp.label}
            </button>
          ))}
        </div>

        <Section title={t('activityReview')} />
        <div style={{ margin: '4px 0 14px' }}>
          <Segmented value={period} onChange={setPeriod} options={[
            { value: 'daily', label: lang === 'ar' ? 'يومي' : 'Daily' },
            { value: 'weekly', label: lang === 'ar' ? 'أسبوعي' : 'Weekly' },
            { value: 'monthly', label: lang === 'ar' ? 'شهري' : 'Monthly' },
          ]} />
        </div>
        <div className="stat-grid">
          <Stat label={lang === 'ar' ? 'مكتملة' : 'Completed'} value={r.completed.length} />
          <Stat label={lang === 'ar' ? 'مفتوحة' : 'Open'} value={r.open.length} />
          <Stat label={t('overdue')} value={r.overdue.length} />
          <Stat label={t('delegated')} value={r.delegated.length} />
        </div>
        <Card style={{ marginTop: 14, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase' }}>{lang === 'ar' ? 'الإنفاق' : 'Spending'}</div>
          <div style={{ fontSize: 30, fontWeight: 780, marginTop: 4 }} className="tnum">{money(r.spend, cur, lang)}</div>
        </Card>

        {r.renewals.length > 0 && (
          <>
            <Section title={t('renewals')} count={r.renewals.length} />
            {r.renewals.map(({ v, dd }) => (
              <div className="li" key={v.id} onClick={() => go(`garage/${v.id}`)}>
                <div className="lead t-warn"><Icon name="shield" size={18} /></div>
                <div className="body"><div className="title">{v.nickname || v.name}</div><div className="meta">{t('insurance')}</div></div>
                <span className="chip t-warn">{dd}d</span>
              </div>
            ))}
          </>
        )}

        <Button block variant="brand" icon="whatsapp" style={{ marginTop: 20 }} onClick={() => share(text)}>{t('shareWhatsApp')}</Button>
      </div>
    </>
  )
}
