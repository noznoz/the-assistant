import React, { useCallback, useEffect } from 'react'
import './theme/tokens.css'
import './theme/components.css'
import { StoreProvider, useStore, useSettings } from './store/StoreProvider.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { I18nProvider, useT } from './i18n/I18nProvider.jsx'
import { useRouter } from './lib/router.js'
import { BottomNav, navMiddle } from './ui/AppShell.jsx'
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
import MessageScreen from './features/message/MessageScreen.jsx'
import SearchScreen from './features/search/SearchScreen.jsx'
import NotesScreen from './features/notes/NotesScreen.jsx'
import ProjectsScreen from './features/projects/ProjectsScreen.jsx'
import ExpenseReportScreen from './features/expenses/ExpenseReportScreen.jsx'
import BudgetsScreen from './features/expenses/BudgetsScreen.jsx'
import SubscriptionsScreen from './features/expenses/SubscriptionsScreen.jsx'
import RewardsScreen from './features/people/RewardsScreen.jsx'
import GroupsScreen from './features/people/GroupsScreen.jsx'
import IncomeScreen from './features/finance/IncomeScreen.jsx'
import InvestmentsScreen from './features/finance/InvestmentsScreen.jsx'
import AccountsScreen from './features/finance/AccountsScreen.jsx'
import NetWorthScreen from './features/finance/NetWorthScreen.jsx'
import ZakatScreen from './features/finance/ZakatScreen.jsx'
import TrendsScreen from './features/finance/TrendsScreen.jsx'
import LiabilitiesScreen from './features/finance/LiabilitiesScreen.jsx'
import MoneyCalendarScreen from './features/finance/MoneyCalendarScreen.jsx'
import StatementScreen from './features/finance/StatementScreen.jsx'
import PropertiesScreen from './features/properties/PropertiesScreen.jsx'
import ValuablesScreen from './features/valuables/ValuablesScreen.jsx'
import WeekScreen from './features/week/WeekScreen.jsx'
import MembershipsScreen from './features/memberships/MembershipsScreen.jsx'
import RenewalsScreen from './features/renewals/RenewalsScreen.jsx'
import MonthlyReportScreen from './features/reports/MonthlyReportScreen.jsx'
import ForecastScreen from './features/finance/ForecastScreen.jsx'
import EmergencyScreen from './features/emergency/EmergencyScreen.jsx'
import WishlistScreen from './features/wishlist/WishlistScreen.jsx'
import GoalsScreen from './features/finance/GoalsScreen.jsx'
import DashboardScreen from './features/today/DashboardScreen.jsx'
import AppointmentsScreen from './features/appointments/AppointmentsScreen.jsx'
import OccasionsScreen from './features/occasions/OccasionsScreen.jsx'
import StaffScreen from './features/staff/StaffScreen.jsx'
import DebtPayoffScreen from './features/finance/DebtPayoffScreen.jsx'
import HijriScreen from './features/hijri/HijriScreen.jsx'
import AllocationScreen from './features/finance/AllocationScreen.jsx'
import WorkScreen from './features/work/WorkScreen.jsx'
import WorkDashboardScreen from './features/work/WorkDashboardScreen.jsx'
import MeetingsScreen from './features/work/MeetingsScreen.jsx'
import SpiritualScreen from './features/spiritual/SpiritualScreen.jsx'
import GivingScreen from './features/giving/GivingScreen.jsx'
import KeepInTouchScreen from './features/people/KeepInTouchScreen.jsx'
import NavTabsScreen from './features/settings/NavTabsScreen.jsx'

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
      case 'message': return <MessageScreen go={go} />
      case 'notes': return <NotesScreen go={go} />
      case 'projects': return <ProjectsScreen param={param} go={go} />
      case 'expensereport': return <ExpenseReportScreen go={go} />
      case 'budgets': return <BudgetsScreen go={go} />
      case 'subscriptions': return <SubscriptionsScreen go={go} />
      case 'rewards': return <RewardsScreen go={go} />
      case 'groups': return <GroupsScreen go={go} />
      case 'income': return <IncomeScreen go={go} />
      case 'investments': return <InvestmentsScreen go={go} />
      case 'accounts': return <AccountsScreen go={go} />
      case 'networth': return <NetWorthScreen go={go} />
      case 'zakat': return <ZakatScreen go={go} />
      case 'trends': return <TrendsScreen go={go} />
      case 'liabilities': return <LiabilitiesScreen go={go} />
      case 'moneycal': return <MoneyCalendarScreen go={go} />
      case 'statement': return <StatementScreen go={go} />
      case 'properties': return <PropertiesScreen param={param} go={go} />
      case 'valuables': return <ValuablesScreen go={go} />
      case 'week': return <WeekScreen go={go} />
      case 'memberships': return <MembershipsScreen go={go} />
      case 'renewals': return <RenewalsScreen go={go} />
      case 'monthlyreport': return <MonthlyReportScreen go={go} />
      case 'forecast': return <ForecastScreen go={go} />
      case 'emergency': return <EmergencyScreen go={go} />
      case 'wishlist': return <WishlistScreen go={go} />
      case 'goals': return <GoalsScreen go={go} />
      case 'dashboard': return <DashboardScreen go={go} />
      case 'appointments': return <AppointmentsScreen go={go} />
      case 'occasions': return <OccasionsScreen go={go} />
      case 'staff': return <StaffScreen go={go} />
      case 'debtpayoff': return <DebtPayoffScreen go={go} />
      case 'hijri': return <HijriScreen go={go} />
      case 'allocation': return <AllocationScreen go={go} />
      case 'work': return <WorkScreen param={param} go={go} />
      case 'workboard': return <WorkDashboardScreen go={go} />
      case 'meetings': return <MeetingsScreen param={param} go={go} />
      case 'spiritual': return <SpiritualScreen go={go} />
      case 'giving': return <GivingScreen go={go} />
      case 'keepintouch': return <KeepInTouchScreen go={go} />
      case 'navtabs': return <NavTabsScreen go={go} />
      case 'search': return <SearchScreen go={go} />
      default: return <TodayScreen go={go} />
    }
  })()

  // Bottom nav highlights whichever tab the current route belongs to. The middle
  // tabs are user-chosen, so a route's "parent" only lights up if it's in the bar;
  // otherwise everything falls back to More.
  const parentOf = (tb) => {
    if (['projects', 'expensereport', 'budgets', 'subscriptions', 'income', 'investments', 'accounts', 'networth', 'zakat', 'trends', 'liabilities', 'moneycal', 'statement', 'properties', 'forecast', 'goals', 'debtpayoff', 'allocation'].includes(tb)) return 'expenses'
    if (['work', 'workboard', 'meetings'].includes(tb)) return 'tasks'
    if (tb === 'dashboard') return 'today'
    return 'more'
  }
  const navSet = new Set(['today', ...navMiddle(settings), 'more'])
  const activeTab = navSet.has(tab) ? tab
    : (navSet.has(parentOf(tab)) ? parentOf(tab) : 'more')

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
