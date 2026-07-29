import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { RELATIONSHIPS, label } from '../../lib/domain.js'
import { whatsappToPerson, personDigits } from '../../lib/share.js'
import PersonEditor from './PersonEditor.jsx'
import PersonProfile from './PersonProfile.jsx'

const WORK_RELS = ['colleague', 'report', 'manager']

export default function PeopleScreen({ go }) {
  const { t, lang } = useT()
  const people = useCollection('people')
  const tasks = useCollection('tasks')
  const [editor, setEditor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [filter, setFilter] = useState('all')
  const toast = useToast()

  const current = viewing && people.items.find(p => p.id === viewing.id)
  if (current) {
    return <PersonProfile person={current} onBack={() => setViewing(null)} onDeleted={() => setViewing(null)} />
  }

  const openFor = (p) => tasks.items.filter(x =>
    ((x.assigneeId && x.assigneeId === p.id) || (!x.assigneeId && x.assignedTo === p.name)) &&
    x.status !== 'completed' && x.status !== 'cancelled')

  const list = people.items.filter(p => {
    if (filter === 'all') return true
    if (filter === 'family') return p.relationship === 'family'
    if (filter === 'work') return WORK_RELS.includes(p.relationship)
    return true
  })

  const filters = [
    { id: 'all', label: t('all') },
    { id: 'family', label: t('family') },
    { id: 'work', label: t('work') },
  ]

  return (
    <>
      <DetailHeader title={t('people')} onBack={() => go('more')} right={
        <>
          <button className="iconbtn" onClick={() => go('message')} aria-label={t('sendMessage')} style={{ color: 'var(--ok)' }}><Icon name="whatsapp" size={18} /></button>
          <button className="iconbtn" onClick={() => go('rewards')} aria-label={t('rewardsStore')}><Icon name="gift" size={18} /></button>
        </>
      } />
      <div className="screen">
        {people.items.length === 0 ? (
          <Empty icon="people" title={t('nothingHere')} text={t('addFamily')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('addFamily')}</Button>} />
        ) : (
          <>
            <div className="chip-row" style={{ margin: '14px 0 4px' }}>
              {filters.map(fl => (
                <Chip key={fl.id} selectable on={filter === fl.id} onClick={() => setFilter(fl.id)}>{fl.label}</Chip>
              ))}
            </div>
            {filter === 'family' && (() => {
              const board = people.items.filter(p => p.relationship === 'family' && (Number(p.points) || 0) > 0)
                .sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0)).slice(0, 3)
              if (!board.length) return null
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div className="card tight" style={{ margin: '8px 0 4px' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{t('leaderboard')}</div>
                  {board.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                      <span style={{ fontSize: 18 }}>{medals[i]}</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                      <b className="tnum">{Number(p.points) || 0} <span className="muted" style={{ fontWeight: 500 }}>{t('pts')}</span></b>
                    </div>
                  ))}
                </div>
              )
            })()}
            {list.map(p => {
              const open = openFor(p)
              const rel = RELATIONSHIPS.find(r => r.id === p.relationship)
              const initials = (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div className="li" key={p.id} onClick={() => setViewing(p)}>
                  <div className="lead" style={{ padding: 0, overflow: 'hidden', background: 'var(--brand-tint)', color: 'var(--brand-600)', fontWeight: 750 }}>
                    {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                  </div>
                  <div className="body">
                    <div className="title">{p.name}</div>
                    <div className="meta">
                      {[rel ? label(rel, lang) : '', p.jobTitle].filter(Boolean).join(' · ')}
                      {open.length > 0 && <span className="chip t-warn" style={{ padding: '1px 7px' }}>{open.length} {t('openLabel')}</span>}
                      {(Number(p.points) || 0) > 0 && <span className="chip t-brand" style={{ padding: '1px 7px' }}>{p.points} {t('pts')}</span>}
                    </div>
                  </div>
                  {personDigits(p) && (
                    <button className="iconbtn" style={{ color: 'var(--ok)' }} aria-label={t('message')}
                      onClick={(e) => { e.stopPropagation(); whatsappToPerson(p, lang === 'ar' ? `مرحباً ${p.name}` : `Hi ${p.name}`) }}>
                      <Icon name="whatsapp" size={18} />
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <PersonEditor initial={editor.id ? editor : { relationship: filter === 'work' ? 'colleague' : 'family' }}
        onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}
