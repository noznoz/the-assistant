import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Chip, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { buildRenewals, urgency } from '../../lib/renewals.js'
import { fmtDate, relativeDay } from '../../lib/format.js'
import { useSettings } from '../../store/StoreProvider.jsx'

// A watchtower for everything that expires: IDs, passports, licenses, vehicle
// insurance & registration (Istimara), documents, memberships, warranties.
export default function RenewalsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const people = useCollection('people')
  const vehicles = useCollection('vehicles')
  const documents = useCollection('documents')
  const memberships = useCollection('memberships')
  const valuables = useCollection('valuables')
  const properties = useCollection('properties')
  const staff = useCollection('staff')

  const items = useMemo(() => buildRenewals({
    people: people.items, vehicles: vehicles.items, documents: documents.items,
    memberships: memberships.items, valuables: valuables.items, properties: properties.items, staff: staff.items, t, lang,
  }), [people.items, vehicles.items, documents.items, memberships.items, valuables.items, properties.items, staff.items, lang])

  const expired = items.filter(x => x.days < 0)
  const soon = items.filter(x => x.days >= 0 && x.days <= 30)
  const upcoming = items.filter(x => x.days > 30 && x.days <= 90)
  const later = items.filter(x => x.days > 90)

  const groups = [
    { key: 'expired', tint: 't-danger', icon: 'clock', list: expired },
    { key: 'dueSoon', tint: 't-danger', icon: 'shield', list: soon },
    { key: 'upcoming', tint: 't-warn', icon: 'bell', list: upcoming },
    { key: 'later', tint: 't-info', icon: 'calendar', list: later },
  ].filter(g => g.list.length > 0)

  return (
    <>
      <DetailHeader title={t('renewalRadar')} onBack={() => go('more')} />
      <div className="screen">
        {items.length === 0 ? (
          <Empty icon="shield" title={t('allClear')} text={t('renewalsEmptyHint')} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <SummaryTile n={expired.length} label={t('expired')} tint="t-danger" onClick={() => {}} />
              <SummaryTile n={soon.length} label={t('within30')} tint="t-warn" />
              <SummaryTile n={upcoming.length} label={t('within90')} tint="t-info" />
            </div>

            {groups.map(g => (
              <React.Fragment key={g.key}>
                <Section title={t(g.key)} count={g.list.length} />
                <Card tight>
                  {g.list.map(it => {
                    const u = urgency(it.days)
                    return (
                      <div className="li" key={it.id} onClick={() => go(it.go)}>
                        <div className={`lead ${u.tint}`}><Icon name={it.icon} size={18} /></div>
                        <div className="body">
                          <div className="title">{it.title}</div>
                          <div className="meta">{it.sub} · {fmtDate(it.date, lang, settings.dateFormat)}</div>
                        </div>
                        <Chip tint={u.tint}>{it.days < 0 ? t('expired') : relativeDay(it.date, lang)}</Chip>
                      </div>
                    )
                  })}
                </Card>
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </>
  )
}

function SummaryTile({ n, label, tint }) {
  return (
    <Card tight style={{ textAlign: 'center', padding: '14px 8px' }}>
      <div className={tint} style={{ fontSize: 30, fontWeight: 780, lineHeight: 1 }}>{n}</div>
      <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>{label}</div>
    </Card>
  )
}
