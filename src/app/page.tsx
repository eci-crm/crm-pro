'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useCrmStore } from '@/lib/store'
import CrmLayout from '@/components/crm-layout'
import LoginPage from '@/components/login-page'
import Dashboard from '@/components/crm/dashboard'
import ClientsPage from '@/components/crm/clients'
import ProposalsPage from '@/components/crm/proposals'
import CalendarPage from '@/components/crm/calendar'
import ResourcesPage from '@/components/crm/resources'
import ReportsPage from '@/components/crm/reports'
import AuditTrailPage from '@/components/crm/audit'
import SettingsPage from '@/components/crm/settings'

const pageComponents: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  clients: ClientsPage,
  proposals: ProposalsPage,
  calendar: CalendarPage,
  resources: ResourcesPage,
  reports: ReportsPage,
  audit: AuditTrailPage,
  settings: SettingsPage,
}

export default function Home() {
  const isAuthenticated = useCrmStore((s) => s.isAuthenticated)
  const currentPage = useCrmStore((s) => s.currentPage)

  // Returns false on server, true on client — no state, no effect, no lint error
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // Defer rendering until client-side hydration completes to avoid mismatch
  // between server (always unauthenticated) and client (may read localStorage)
  if (!mounted) {
    return null
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const PageComponent = pageComponents[currentPage] ?? Dashboard

  return (
    <CrmLayout>
      <PageComponent />
    </CrmLayout>
  )
}
