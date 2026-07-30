import React, { useState, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore } from '../../store/StoreProvider.jsx'

// Global search across tasks, vehicles, expenses, people, documents, notes.
export default function SearchScreen({ go }) {
  const { t } = useT()
  const { data } = useStore()
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const out = []
    const push = (kind, icon, target, item, text) => {
      if (text.toLowerCase().includes(s)) out.push({ kind, icon, target, id: item.id, label: text })
    }
    data.tasks?.forEach(x => push(t('tasks'), 'check', 'tasks', x, `${x.title} ${x.assignedTo || ''} ${x.project || ''}`))
    data.vehicles?.forEach(x => push(t('garage'), 'car', `garage/${x.id}`, x, `${x.name} ${x.nickname || ''} ${x.plate || ''}`))
    data.properties?.forEach(x => push(t('properties'), 'doc', `properties/${x.id}`, x, `${x.name} ${x.address || ''}`))
    data.expenses?.forEach(x => push(t('expenses'), 'wallet', 'expenses', x, `${x.merchant || ''} ${x.item || ''} ${x.amount}`))
    data.income?.forEach(x => push(t('income'), 'wallet', 'income', x, `${x.note || ''} ${x.source || ''} ${x.amount}`))
    data.liabilities?.forEach(x => push(t('liabilities'), 'wallet', 'liabilities', x, `${x.name} ${x.lender || ''}`))
    data.investments?.forEach(x => push(t('investments'), 'chart', 'investments', x, x.name))
    data.subscriptions?.forEach(x => push(t('subscriptions'), 'refresh', 'subscriptions', x, x.name))
    data.projects?.forEach(x => push(t('projects'), 'report', `projects/${x.id}`, x, x.name))
    data.trips?.forEach(x => push(t('trips'), 'trip', 'trips', x, `${x.name} ${x.destination || ''}`))
    data.valuables?.forEach(x => push(t('valuables'), 'gift', 'valuables', x, `${x.name} ${x.brand || ''} ${x.model || ''} ${x.serial || ''}`))
    data.memberships?.forEach(x => push(t('memberships'), 'gift', 'memberships', x, `${x.name} ${x.tier || ''} ${x.number || ''}`))
    data.people?.forEach(x => push(t('people'), 'people', 'people', x, `${x.name} ${x.company || ''} ${x.jobTitle || ''}`))
    data.documents?.forEach(x => push(t('documents'), 'doc', 'documents', x, x.title))
    data.notes?.forEach(x => push(t('quickNotes'), 'note', 'notes', x, x.text || ''))
    return out.slice(0, 50)
  }, [q, data])

  return (
    <>
      <DetailHeader title={t('search')} onBack={() => go('today')} />
      <div className="screen">
        <div className="field" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', padding: '0 12px' }}>
            <Icon name="search" size={18} style={{ color: 'var(--ink-3)' }} />
            <input className="input" style={{ border: 0, background: 'transparent', padding: '13px 0' }}
              value={q} onChange={e => setQ(e.target.value)} placeholder={t('search')} autoFocus />
          </div>
        </div>
        {q && results.length === 0 ? (
          <Empty icon="search" title={t('nothingHere')} />
        ) : results.map(r => (
          <div className="li" key={r.kind + r.id} onClick={() => go(r.target)}>
            <div className="lead t-brand"><Icon name={r.icon} size={18} /></div>
            <div className="body"><div className="title">{r.label}</div><div className="meta">{r.kind}</div></div>
            <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
          </div>
        ))}
      </div>
    </>
  )
}
