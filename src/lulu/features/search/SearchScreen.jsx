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
    data.tasks?.forEach(x => push(t('tasks'), 'check', 'tasks', x, x.title))
    data.vehicles?.forEach(x => push(t('garage'), 'car', `garage/${x.id}`, x, `${x.name} ${x.nickname || ''}`))
    data.expenses?.forEach(x => push(t('expenses'), 'wallet', 'expenses', x, `${x.merchant || ''} ${x.amount}`))
    data.people?.forEach(x => push(t('people'), 'people', 'people', x, x.name))
    data.documents?.forEach(x => push(t('documents'), 'doc', 'documents', x, x.title))
    data.notes?.forEach(x => push(t('quickNotes'), 'note', 'today', x, x.text || ''))
    return out.slice(0, 40)
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
