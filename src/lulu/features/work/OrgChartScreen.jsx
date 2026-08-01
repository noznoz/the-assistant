import React from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Empty, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { teamSize, deptRoots } from '../../lib/org.js'
import { roleLabel } from '../../lib/domain.js'
import { whatsappToPerson } from '../../lib/share.js'

// Company-wide org chart: You at the top, then each department's head and their
// reporting tree beneath.
export default function OrgChartScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const departments = useCollection('departments')
  const members = useCollection('members')
  const p = settings.profile || {}
  const youName = p.fullName || settings.name || t('me')

  const childrenOf = (id, team) => team.filter(m => m.reportsToId === id)

  const Node = ({ m, team, depth, dep }) => {
    const n = teamSize(m.id, team)
    const kids = childrenOf(m.id, team)
    return (
      <>
        <div className="li" style={{ marginInlineStart: depth * 15 }}>
          {depth > 0 && <span style={{ width: 10, color: 'var(--ink-3)', flexShrink: 0 }}>└</span>}
          <div className={`lead ${dep.headId === m.id ? 't-brand' : ''}`} style={{ background: dep.headId === m.id ? undefined : 'var(--surface-2)' }}><Icon name={dep.headId === m.id ? 'flag' : 'people'} size={16} /></div>
          <div className="body" onClick={() => go(`work/${dep.id}`)}>
            <div className="title">{m.name}{dep.headId === m.id ? ` · ${t('head')}` : ''}</div>
            <div className="meta">{roleLabel(m, lang)}</div>
          </div>
          {n > 0 && <span className="chip" title={t('teamSizeLabel')}>{n}</span>}
          {(m.whatsapp || m.mobile) && <button className="iconbtn" aria-label="WhatsApp" onClick={() => whatsappToPerson(m, '')}><Icon name="whatsapp" size={15} /></button>}
        </div>
        {kids.map(k => <Node key={k.id} m={k} team={team} depth={depth + 1} dep={dep} />)}
      </>
    )
  }

  const totalPeople = members.items.length

  return (
    <>
      <DetailHeader title={t('orgChart')} onBack={() => go('work')} />
      <div className="screen">
        {departments.items.length === 0 ? (
          <Empty icon="people" title={t('noDepartments')} text={t('departmentsHint')}
            action={<Button variant="primary" icon="report" onClick={() => go('work')}>{t('work')}</Button>} />
        ) : (
          <Card tight style={{ marginTop: 14 }}>
            {/* You */}
            <div className="li">
              <div className="lead t-brand" style={{ width: 42, height: 42, borderRadius: 12 }}>
                {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }} /> : <Icon name="people" size={20} />}
              </div>
              <div className="body">
                <div className="title" style={{ fontWeight: 750 }}>{youName}</div>
                <div className="meta">{p.jobTitle || t('you')} · {totalPeople} {t('membersLower')}</div>
              </div>
            </div>

            {departments.items.map(dep => {
              const { head, orphans, team } = deptRoots(dep, members.items)
              const tops = head ? [head, ...orphans] : orphans
              return (
                <React.Fragment key={dep.id}>
                  <div className="li" style={{ marginInlineStart: 15 }} onClick={() => go(`work/${dep.id}`)}>
                    <span style={{ width: 10, color: 'var(--ink-3)', flexShrink: 0 }}>└</span>
                    <div className="lead" style={{ background: 'var(--brand-tint)', color: 'var(--brand-600)' }}><Icon name="report" size={16} /></div>
                    <div className="body"><div className="title" style={{ fontWeight: 700 }}>{dep.name}</div><div className="meta">{team.length} {t('membersLower')}</div></div>
                    <Icon name="chevron" size={15} style={{ color: 'var(--ink-3)' }} />
                  </div>
                  {tops.map(m => <Node key={m.id} m={m} team={team} depth={2} dep={dep} />)}
                </React.Fragment>
              )
            })}
          </Card>
        )}
        <p className="hint center" style={{ marginTop: 12 }}>{t('orgChartFooter')}</p>
      </div>
    </>
  )
}
