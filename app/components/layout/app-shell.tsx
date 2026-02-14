import { AppSidebar } from './app-sidebar'
import { Header } from './header'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { SidebarProvider, SidebarInset } from '~/components/ui/sidebar'

type AppShellProps = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  isOrgAdmin: boolean
  children: React.ReactNode
}

export function AppShell({ user, isOrgAdmin, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} isOrgAdmin={isOrgAdmin} />
      <SidebarInset className="relative flex h-svh flex-col overflow-hidden">
        <AzulejoPattern baseOpacity={0.04} hoverOpacity={0.15} />
        <Header />
        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
