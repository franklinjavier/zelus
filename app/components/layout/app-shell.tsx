import { useCallback, useState } from 'react'

import { CommandSearch } from '~/components/shared/command-search'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { Header } from './header'

type Org = { id: string; name: string }

type AppShellProps = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  org: Org
  orgs: Org[]
  isOrgAdmin: boolean
  unreadCount?: number
  children: React.ReactNode
}

export function AppShell({ user, org, orgs, isOrgAdmin, unreadCount, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])

  return (
    <SidebarProvider>
      <AppSidebar user={user} org={org} orgs={orgs} isOrgAdmin={isOrgAdmin} />
      <SidebarInset className="relative flex h-svh flex-col overflow-hidden">
        <Header unreadCount={unreadCount} onSearchOpen={openSearch} />
        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">{children}</div>
      </SidebarInset>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} isOrgAdmin={isOrgAdmin} />
    </SidebarProvider>
  )
}
