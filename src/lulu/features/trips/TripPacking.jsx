import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Section, Input, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { uid } from '../../store/db.js'

const SUGGESTIONS = ['Passport', 'Chargers', 'Medication', 'Toiletries', 'Adapter', 'Sunglasses']

// A simple packing checklist stored on the trip record.
export default function TripPacking({ trip }) {
  const { t } = useT()
  const trips = useCollection('trips')
  const [text, setText] = useState('')
  const items = trip.packing || []
  const done = items.filter(i => i.done).length

  const save = (next) => trips.save({ ...trip, packing: next })
  const add = (label) => {
    const v = (label || '').trim()
    if (!v) return
    save([...items, { id: uid(), text: v, done: false }])
    setText('')
  }
  const toggle = (id) => save(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  const remove = (id) => save(items.filter(i => i.id !== id))
  const missing = SUGGESTIONS.filter(s => !items.some(i => i.text.toLowerCase() === s.toLowerCase()))

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder={t('packingPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter') add(text) }} style={{ flex: 1 }} />
        <Button icon="plus" onClick={() => add(text)}>{t('add')}</Button>
      </div>

      {missing.length > 0 && (
        <div className="chip-row" style={{ marginTop: 10 }}>
          {missing.map(s => <button key={s} className="chip" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}

      {items.length > 0 && (
        <>
          <Section title={t('packingList')} count={`${done}/${items.length}`} />
          <Card tight>
            {items.map(i => (
              <div className="li" key={i.id} onClick={() => toggle(i.id)}>
                <div className={`lead ${i.done ? 't-ok' : ''}`} style={{ background: i.done ? undefined : 'var(--surface-2)' }}>
                  {i.done ? <Icon name="check" size={18} /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--ink-3)' }} />}
                </div>
                <div className="body"><div className="title" style={{ textDecoration: i.done ? 'line-through' : 'none', opacity: i.done ? 0.6 : 1 }}>{i.text}</div></div>
                <button className="iconbtn" aria-label={t('delete')} onClick={(e) => { e.stopPropagation(); remove(i.id) }}><Icon name="x" size={15} /></button>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
