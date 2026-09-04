import { useMemo } from 'react'
import { useStore, useSettings } from './StoreProvider.jsx'
import { useT } from '../i18n/I18nProvider.jsx'
import { buildNotificationFeed } from '../lib/notifications.js'

// Single source of truth for the live notification feed. The Today screen, the
// Notifications screen and the home-badge / due-alerts effect all read it from
// here, so the set of input collections (and the settings/locale they depend on)
// can never drift between the three call sites.
export function useNotificationFeed() {
  const { data } = useStore()
  const { settings } = useSettings()
  const { t, lang } = useT()
  return useMemo(() => buildNotificationFeed({
    tasks: data.tasks, vehicles: data.vehicles, services: data.services,
    docs: data.documents, subs: data.subscriptions, people: data.people,
    expenses: data.expenses, valuables: data.valuables, appointments: data.appointments,
    reminders: data.reminders, t, lang, settings,
  }), [data.tasks, data.vehicles, data.services, data.documents, data.subscriptions,
    data.people, data.expenses, data.valuables, data.appointments, data.reminders,
    settings, lang, t])
}
