import { NavLink, Form, useLocation } from 'react-router'
import { Collapsible } from '@base-ui/react/collapsible'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardSquare01Icon,
  Ticket02Icon,
  Building06Icon,
  TruckDeliveryIcon,
  WrenchIcon,
  Settings02Icon,
  Logout03Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons'

import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '~/components/ui/sidebar'

type AppSidebarProps = {
  user: { id: string; name: string; email: string; image: string | null }
  isOrgAdmin: boolean
}

const mainNav = [
  { label: 'Painel', to: '/dashboard', icon: DashboardSquare01Icon },
  { label: 'Ocorrências', to: '/tickets', icon: Ticket02Icon },
  { label: 'Frações', to: '/fractions', icon: Building06Icon },
  { label: 'Fornecedores', to: '/suppliers', icon: TruckDeliveryIcon },
  { label: 'Manutenções', to: '/maintenance', icon: WrenchIcon },
  { label: 'Conta', to: '/settings/account', icon: Settings02Icon },
]

const adminNav = [
  { label: 'Associações', to: '/admin/associations' },
  { label: 'Convites', to: '/admin/invites' },
  { label: 'Categorias', to: '/admin/categories' },
]

export function AppSidebar({ user, isOrgAdmin }: AppSidebarProps) {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  return (
    <Sidebar variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <ZelusLogoTile size={24} className="text-primary" />
          <span className="text-sm font-semibold tracking-tight">Zelus</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                        <HugeiconsIcon icon={item.icon} size={16} strokeWidth={2} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}

              {isOrgAdmin && (
                <Collapsible.Root defaultOpen={isAdminRoute}>
                  <SidebarMenuItem>
                    <Collapsible.Trigger
                      render={
                        <SidebarMenuButton tooltip="Administração">
                          <HugeiconsIcon icon={Settings02Icon} size={16} strokeWidth={2} />
                          <span>Administração</span>
                          <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            size={14}
                            strokeWidth={2}
                            className="text-muted-foreground ml-auto transition-transform group-data-[panel-open]:rotate-180"
                          />
                        </SidebarMenuButton>
                      }
                    />
                    <Collapsible.Panel>
                      <SidebarMenuSub>
                        {adminNav.map((item) => (
                          <SidebarMenuSubItem key={item.to}>
                            <NavLink to={item.to}>
                              {({ isActive }) => (
                                <SidebarMenuSubButton isActive={isActive}>
                                  <span>{item.label}</span>
                                </SidebarMenuSubButton>
                              )}
                            </NavLink>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </Collapsible.Panel>
                  </SidebarMenuItem>
                </Collapsible.Root>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-sm">{user.email}</p>
          </div>
          <Form method="post" action="/auth/signout">
            <Button type="submit" variant="ghost" size="icon-sm" title="Sair">
              <HugeiconsIcon icon={Logout03Icon} size={16} strokeWidth={2} />
              <span className="sr-only">Sair</span>
            </Button>
          </Form>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
