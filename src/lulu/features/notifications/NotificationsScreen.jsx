import React, { useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useSettings } from '../../store/StoreProvider.jsx'
import { useNotificationFeed } from '../../store/useNotificationFeed.js'

// A live notification feed derived from tasks, renewals, reminders and more.
export default function NotificationsScreen({ go }) {
  const { t } = useT()
  const { settings, updateSettings } = useSettings()
  const feed = useNotificationFeed()

  const seen = new Set(settings.notificationsSeen || [])

  // Opening this screen marks everything currently shown as read. We store the
  // exact set of visible ids (self-pruning: old ids drop out as they resolve).
  useEffect(() => {
    const ids = feed.map(n => n.id)
    const prev = settings.notificationsSeen || []
    const same = ids.length === prev.length && ids.every(id => prev.includes(id))
    if (!same) updateSettings({ notificationsSeen: ids })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed])

  return (
    <>
      <DetailHeader title={t('notifications')} onBack={() => go('today')} />
      <div className="screen">
        {feed.length === 0 ? (
          <Empty icon="bell" title={t('nothingHere')} text={t('noThingsToday')} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {feed.map(n => {
              const isNew = !seen.has(n.id)
              return (
                <div className="li" key={n.id} onClick={() => go(n.go)}>
                  <div className={`lead ${n.tint}`}><Icon name={n.icon} size={18} /></div>
                  <div className="body">
                    <div className="title">{n.title}{isNew && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-600)', marginInlineStart: 8, verticalAlign: 'middle' }} />}</div>
                    <div className="meta">{n.meta}</div>
                  </div>
                  <Icon name="chevron" size={16} style={{ color: 'var(--ink-3)' }} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
