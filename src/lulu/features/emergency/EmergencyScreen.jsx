import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { share } from '../../lib/share.js'
import { printHtml } from '../../lib/exporters.js'

// A single "in case of emergency" sheet: the family's medical essentials and
// key contacts, shareable with a doctor or relative in one tap.
export default function EmergencyScreen({ go }) {
  const { t } = useT()
  const { settings } = useSettings()
  const people = useCollection('people')

  // Anyone with medical info or a contact number is worth showing; family first.
  const members = useMemo(() => {
    const has = (p) => p.bloodType || p.allergies || p.conditions || p.medications || p.mobile || p.doctor
    return people.items.filter(has).sort((a, b) =>
      (a.relationship === 'family' ? 0 : 1) - (b.relationship === 'family' ? 0 : 1))
  }, [people.items])

  const rows = (p) => [
    [t('bloodType'), p.bloodType],
    [t('allergies'), p.allergies],
    [t('conditions'), p.conditions],
    [t('medications'), p.medications],
    [t('doctor'), p.doctor],
    [t('healthInsurer'), p.healthInsurer && `${p.healthInsurer}${p.healthPolicy ? ' · ' + p.healthPolicy : ''}`],
    [t('mobile'), p.mobile],
  ].filter(([, v]) => v)

  const asText = () => {
    const lines = [`🆘 *${t('emergencyCard')}*`, settings.name ? `${t('family')}: ${settings.name}` : '', '']
    members.forEach(p => {
      lines.push(`*${p.name}*${p.jobTitle ? ` — ${p.jobTitle}` : ''}`)
      rows(p).forEach(([k, v]) => lines.push(`• ${k}: ${v}`))
      lines.push('')
    })
    lines.push('— The Assistant')
    return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
  }

  const doShare = () => share(asText(), t('emergencyCard'))
  const doPrint = () => {
    const body = `<h1>${t('emergencyCard')}</h1><div class="sub">${settings.name || ''}</div>` +
      members.map(p => `<h2>${p.name}${p.jobTitle ? ' — ' + p.jobTitle : ''}</h2><table>` +
        rows(p).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + '</table>').join('')
    printHtml(t('emergencyCard'), body)
  }

  return (
    <>
      <DetailHeader title={t('emergencyCard')} onBack={() => go('more')} />
      <div className="screen">
        {members.length === 0 ? (
          <Empty icon="shield" title={t('emergencyEmpty')} text={t('emergencyEmptyHint')}
            action={<Button variant="primary" icon="people" onClick={() => go('people')}>{t('people')}</Button>} />
        ) : (
          <>
            <Card style={{ marginTop: 14, background: 'var(--brand-tint)', borderColor: 'transparent' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="t-brand" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface)' }}><Icon name="shield" size={22} /></span>
                <div><div style={{ fontWeight: 750 }}>{t('emergencyCard')}</div><div className="muted" style={{ fontSize: 12.5 }}>{t('emergencyIntro')}</div></div>
              </div>
            </Card>

            {members.map(p => (
              <Card key={p.id} style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontWeight: 750, fontSize: 16 }}>{p.name}</div>
                  {p.jobTitle && <div className="muted" style={{ fontSize: 12.5 }}>{p.jobTitle}</div>}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {rows(p).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                      <span className="muted" style={{ flexShrink: 0 }}>{k}</span>
                      <span style={{ fontWeight: 600, textAlign: 'end' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            <div className="row2" style={{ marginTop: 16 }}>
              <Button variant="primary" icon="whatsapp" onClick={doShare}>{t('share')}</Button>
              <Button icon="download" onClick={doPrint}>{t('shareAsPdf')}</Button>
            </div>
            <p className="hint center" style={{ marginTop: 8 }}>{t('emergencyFooter')}</p>
          </>
        )}
      </div>
    </>
  )
}
