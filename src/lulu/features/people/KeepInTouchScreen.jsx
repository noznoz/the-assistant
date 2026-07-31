import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Chip, Empty, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { daysUntil, relativeDay, todayISO, fmtDate } from '../../lib/format.js'
import { whatsappToPerson, personDigits } from '../../lib/share.js'

// A light personal CRM: contacts you've set a cadence for, surfaced when it's
// time to reach out again.
export default function KeepInTouchScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const people = useCollection('people')
  const toast = useToast()

  const list = useMemo(() => {
    return people.items
      .filter(p => Number(p.keepInTouchDays) > 0)
      .map(p => {
        const base = p.lastContacted || p.createdAt?.slice(0, 10) || todayISO()
        const due = new Date(new Date(base).getTime() + Number(p.keepInTouchDays) * 86400000).toISOString().slice(0, 10)
        return { p, due, days: daysUntil(due) }
      })
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
  }, [people.items])

  const dueNow = list.filter(x => x.days != null && x.days <= 0)
  const soon = list.filter(x => x.days != null && x.days > 0)

  const markContacted = (p) => { people.patch(p.id, { lastContacted: todayISO() }); toast.show(t('markedContacted')) }

  const Row = ({ p, days }) => (
    <div className="li">
      <div className="lead" style={{ overflow: 'hidden', padding: p.photo ? 0 : undefined }}>
        {p.photo ? <img src={p.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          : <span className="t-brand"><Icon name="people" size={18} /></span>}
      </div>
      <div className="body" onClick={() => go('people')}>
        <div className="title">{p.name}</div>
        <div className="meta">
          {p.company || p.jobTitle || ''}
          <span className={days <= 0 ? 't-warn' : ''}>· {days <= 0 ? t('dueNow') : relativeDay(new Date(Date.now() + days * 86400000).toISOString(), lang)}</span>
          {p.lastContacted && <span>· {t('lastLabel')} {fmtDate(p.lastContacted, lang, settings.dateFormat)}</span>}
        </div>
      </div>
      {personDigits(p) && <button className="iconbtn" aria-label="WhatsApp" onClick={() => { whatsappToPerson(p, ''); markContacted(p) }}><Icon name="whatsapp" size={16} /></button>}
      <button className="btn sm" onClick={() => markContacted(p)}>{t('contacted')}</button>
    </div>
  )

  return (
    <>
      <DetailHeader title={t('keepInTouch')} onBack={() => go('people')} />
      <div className="screen">
        {list.length === 0 ? (
          <Empty icon="people" title={t('noKeepInTouch')} text={t('keepInTouchHint')}
            action={<Button variant="primary" icon="people" onClick={() => go('people')}>{t('people')}</Button>} />
        ) : (
          <>
            {dueNow.length > 0 && (<><Section title={t('reachOutNow')} count={dueNow.length} /><Card tight>{dueNow.map(x => <Row key={x.p.id} {...x} />)}</Card></>)}
            {soon.length > 0 && (<><Section title={t('comingUp')} count={soon.length} /><Card tight>{soon.map(x => <Row key={x.p.id} {...x} />)}</Card></>)}
          </>
        )}
        <p className="hint center" style={{ marginTop: 12 }}>{t('keepInTouchFooter')}</p>
      </div>
      {toast.node}
    </>
  )
}
