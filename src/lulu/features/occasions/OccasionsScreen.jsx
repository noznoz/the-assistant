import React, { useMemo, useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Button, Chip, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money, fmtDate } from '../../lib/format.js'
import { WishEditor } from '../wishlist/WishlistScreen.jsx'

// Days until the next occurrence of a month-day (birthday/anniversary).
function nextIn(dateStr) {
  if (!dateStr) return null
  const b = new Date(dateStr); if (isNaN(b)) return null
  const today = new Date(new Date().toISOString().slice(0, 10))
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return { days: Math.round((next - today) / 86400000), date: next, year: b.getFullYear() }
}

// A planner for birthdays & anniversaries, with gift ideas drawn from the
// wishlist (items tagged "for" that person).
export default function OccasionsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const people = useCollection('people')
  const wishlist = useCollection('wishlist')
  const [giftFor, setGiftFor] = useState(null)   // person name to add a gift idea for

  const occasions = useMemo(() => {
    const out = []
    people.items.forEach(p => {
      const b = nextIn(p.birthday)
      if (b) out.push({ id: 'b' + p.id, person: p, kind: t('birthday'), icon: 'cake', ...b, age: b.date.getFullYear() - b.year })
      const a = nextIn(p.anniversary)
      if (a) out.push({ id: 'a' + p.id, person: p, kind: t('anniversary'), icon: 'sparkle', ...a, age: a.date.getFullYear() - a.year })
    })
    return out.sort((x, y) => x.days - y.days)
  }, [people.items, lang])

  const giftsFor = (name) => wishlist.items.filter(w => !w.purchased && (w.forWho || '').toLowerCase() === (name || '').toLowerCase())

  return (
    <>
      <DetailHeader title={t('occasions')} onBack={() => go('more')} />
      <div className="screen">
        {occasions.length === 0 ? (
          <Empty icon="cake" title={t('noOccasions')} text={t('occasionsHint')}
            action={<Button variant="primary" icon="people" onClick={() => go('people')}>{t('people')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {occasions.map(o => {
              const gifts = giftsFor(o.person.name)
              return (
                <Card key={o.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={o.days <= 14 ? 'lead t-brand' : 'lead'} style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: o.days <= 14 ? undefined : 'var(--surface-2)' }}>
                      <Icon name={o.icon} size={20} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{o.person.name} · {o.kind}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>{fmtDate(o.date, lang, settings.dateFormat)}{o.age > 0 ? ` · ${t('turning')} ${o.age}` : ''}</div>
                    </div>
                    <Chip tint={o.days <= 14 ? 't-brand' : 't-info'}>{o.days === 0 ? t('today') : `${o.days}${lang === 'ar' ? '' : 'd'}`}</Chip>
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: gifts.length ? 6 : 0 }}>
                      <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{t('giftIdeas')}</span>
                      <button className="btn sm" onClick={() => setGiftFor(o.person.name)}><Icon name="plus" size={13} /> {t('addIdea')}</button>
                    </div>
                    {gifts.length === 0 ? (
                      <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{t('noGiftIdeas')}</p>
                    ) : gifts.map(g => (
                      <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '3px 0' }}>
                        <span>🎁 {g.name}</span>
                        {g.price > 0 && <span className="tnum muted">{money(g.price, g.currency || cur, lang)}</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
        <p className="hint center" style={{ marginTop: 10 }}>{t('occasionsFooter')}</p>
      </div>
      {giftFor && <WishEditor initial={{ forWho: giftFor, category: 'gift' }} onClose={() => setGiftFor(null)} />}
    </>
  )
}
