import React from 'react'
import './theme/tokens.css'
import './theme/components.css'
import { StoreProvider } from './store/StoreProvider.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { I18nProvider } from './i18n/I18nProvider.jsx'
import { useRouter } from './lib/router.js'
import { BottomNav } from './ui/AppShell.jsx'

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
import SearchScreen from './features/search/SearchScreen.jsx'

const MAIN_TABS = ['today', 'tasks', 'garage', 'expenses', 'more']

function Router() {
  const { tab, param, go } = useRouter('today')

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
      case 'search': return <SearchScreen go={go} />
      default: return <TodayScreen go={go} />
    }
  })()

  // Bottom nav highlights a main tab; sub-screens fall under "more".
  const activeTab = MAIN_TABS.includes(tab) ? tab
    : ['inbox', 'people', 'documents', 'trips', 'reports', 'calendar', 'settings'].includes(tab) ? 'more'
    : tab

  return (
    <div className="app">
      {screen}
      <BottomNav tab={activeTab} go={go} />
    </div>
  )
}

export default function LuluApp() {
  return (
    <StoreProvider>
      <I18nProvider>
        <ThemeProvider>
          <Router />
        </ThemeProvider>
      </I18nProvider>
    </StoreProvider>
  )
}
