import React, { useCallback, useEffect } from 'react'
import './theme/tokens.css'
import './theme/components.css'
import { StoreProvider, useStore, useSettings } from './store/StoreProvider.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { I18nProvider, useT } from './i18n/I18nProvider.jsx'
import { useRouter } from './lib/router.js'
import { BottomNav } from './ui/AppShell.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import Icon from './ui/Icon.jsx'
import { usePullToRefresh } from './ui/usePullToRefresh.js'
import LockGate from './ui/LockGate.jsx'
import { setBadge, maybeDailyBrief } from './lib/notify.js'
import { buildBrief } from './lib/brief.js'
import { isToday, isOverdue } from './lib/format.js'

import TodayScreen from './features/today/TodayScreen.jsx'
import TasksScreen from './features/tasks/TasksScreen.jsx'
import GarageScreen from './features/garage/GarageScreen.jsx'
import ExpensesScreen from './features/expenses/ExpensesScreen.jsx'
import MoreScreen from './features/more/MoreScreen.jsx'
import InboxScreen from './features/inbox/InboxScreen.jsx'
import PeopleScreen from './features/people/PeopleScreen.jsx'
import DocumentsScreen from './features/documents/DocumentsScreen.jsx'
import TripsScreen from './features/trips/TripsScreen.jsx'
import ReportsScreen from './features/reports/ReportsScreen.jsx'
import NotificationsScreen from './features/notifications/NotificationsScreen.jsx'
import CalendarScreen from './features/calendar/CalendarScreen.jsx'
import SettingsScreen from './features/settings/SettingsScreen.jsx'
import ProfileScreen from './features/profile/ProfileScreen.jsx'
import SearchScreen from './features/search/SearchScreen.jsx'
import NotesScreen from './features/notes/NotesScreen.jsx'
import ProjectsScreen from './features/projects/ProjectsScreen.jsx'
import ExpenseReportScreen from './features/expenses/ExpenseReportScreen.jsx'
import BudgetsScreen from './features/expenses/BudgetsScreen.jsx'
import SubscriptionsScreen from './features/expenses/SubscriptionsScreen.jsx'
import RewardsScreen from './features/people/RewardsScreen.jsx'

const MAIN_TABS = ['today', 'tasks', 'garage', 'expenses', 'more']

function Router() {
  const { route, tab, param, go } = useRouter('today')
  const { data, reloadAll } = useStore()
  const { settings } = useSettings()
  const { lang } = useT()

  // Keep the home-screen badge in sync with what needs attention, and fire the
  // daily brief once per day — only when the user has enabled notifications.
  useEffect(() => {
    if (!settings.notifications) { setBadge(0); return }
    const open = (data.tasks || []).filter(x => x.status !== 'completed' && x.status !== 'cancelled')
    const attention = open.filter(x => isOverdue(x.dueDate) || isToday(x.dueDate) || x.status === 'waiting_me').length
    setBadge(attention)
    const brief = buildBrief({ tasks: data.tasks || [], expenses: data.expenses || [], vehicles: data.vehicles || [], settings, lang })
    maybeDailyBrief(settings.name ? `Good morning, ${settings.name}` : 'Your morning brief', brief)
  }, [data.tasks, data.expenses, data.vehicles, settings.notifications, lang])

  // Pull-to-refresh: re-read local data and check for a new app version.
  const onRefresh = useCallback(async () => {
    reloadAll()
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) await reg.update()
      } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 600))
  }, [reloadAll])
  const { pull, refreshing } = usePullToRefresh(onRefresh)

  const screen = (() => {
    switch (tab) {
      case 'today': return <TodayScreen go={go} />
      case 'tasks': return <TasksScreen param={param} go={go} />
      case 'garage': return <GarageScreen param={param} go={go} />
      case 'expenses': return <ExpensesScreen go={go} />
      case 'more': return <MoreScreen go={go} />
      case 'inbox': return <InboxScreen go={go} />
      case 'people': return <PeopleScreen go={go} />
      case 'documents': return <DocumentsScreen go={go} />
      case 'trips': return <TripsScreen go={go} />
      case 'reports': return <ReportsScreen go={go} />
      case 'notifications': return <NotificationsScreen go={go} />
      case 'calendar': return <CalendarScreen go={go} />
      case 'settings': return <SettingsScreen go={go} />
      case 'profile': return <ProfileScreen go={go} />
      case 'notes': return <NotesScreen go={go} />
      case 'projects': return <ProjectsScreen param={param} go={go} />
      case 'expensereport': return <ExpenseReportScreen go={go} />
      case 'budgets': return <BudgetsScreen go={go} />
      case 'subscriptions': return <SubscriptionsScreen go={go} />
      case 'rewards': return <RewardsScreen go={go} />
      case 'search': return <SearchScreen go={go} />
      default: return <TodayScreen go={go} />
    }
  })()

  // Bottom nav highlights a main tab; sub-screens fall under "more".
  const activeTab = MAIN_TABS.includes(tab) ? tab
    : ['projects', 'expensereport', 'budgets', 'subscriptions'].includes(tab) ? 'expenses'
    : ['inbox', 'people', 'documents', 'trips', 'reports', 'calendar', 'settings', 'notes', 'rewards', 'profile'].includes(tab) ? 'more'
    : tab

  const progress = Math.min(1, pull / 72)
  return (
    <div className="app">
      {(pull > 3 || refreshing) && (
        <div className={`ptr ${refreshing ? 'spinning' : ''}`}
          style={{ transform: `translate(-50%, ${Math.max(0, pull - 30)}px)`, opacity: refreshing ? 1 : progress }}>
          <span className="arc" style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}>
            <Icon name="refresh" size={20} />
          </span>
        </div>
      )}
      <ErrorBoundary key={route}>{screen}</ErrorBoundary>
      <BottomNav tab={activeTab} go={go} />
    </div>
  )
}

export default function LuluApp() {
  return (
    <StoreProvider>
      <I18nProvider>
        <ThemeProvider>
          <LockGate>
            <Router />
          </LockGate>
        </ThemeProvider>
      </I18nProvider>
    </StoreProvider>
  )
}
