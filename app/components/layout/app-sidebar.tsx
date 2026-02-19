import { Collapsible } from '@base-ui/react/collapsible'
import {
  AiChat02Icon,
  ArrowDown01Icon,
  Building06Icon,
  Search01Icon,
  ShieldKeyIcon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, NavLink, href, useLocation } from 'react-router'

import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
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
  useSidebar,
} from '~/components/ui/sidebar'
import { NavUser } from './nav-user'
import { OrgSwitcher } from './org-switcher'

type Org = { id: string; name: string }

export type AppSidebarProps = {
  user: { id: string; name: string; email: string; image: string | null }
  org: Org
  orgs: Org[]
  isOrgAdmin: boolean
}

const mainNav = [
  { label: 'Assistente', to: href('/assistant'), icon: AiChat02Icon },
  { label: 'Pesquisa', to: href('/search'), icon: Search01Icon },
  { label: 'Ocorrências', to: href('/tickets'), icon: Ticket02Icon },
  { label: 'Frações', to: href('/fractions'), icon: Building06Icon },
  { label: 'Fornecedores', to: href('/suppliers'), icon: TruckDeliveryIcon },
  { label: 'Manutenções', to: href('/maintenance'), icon: WrenchIcon },
]

const adminNav = [
  { label: 'Painel', to: href('/admin/dashboard') },
  { label: 'Documentos', to: href('/admin/documents') },
  { label: 'Condomínio', to: href('/admin/organization') },
  { label: 'Membros', to: href('/admin/members') },
  { label: 'Associações', to: href('/admin/associations') },
  { label: 'Convites', to: href('/admin/invites') },
  { label: 'Categorias', to: href('/admin/categories') },
]

export function AppSidebar({ user, org, orgs, isOrgAdmin }: AppSidebarProps) {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <Link to={href('/assistant')} className="shrink-0" onClick={() => setOpenMobile(false)}>
            <ZelusLogoTile size={24} className="text-primary" />
          </Link>
          <OrgSwitcher org={org} orgs={orgs} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavLink to={item.to} onClick={() => setOpenMobile(false)}>
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
                          <HugeiconsIcon icon={ShieldKeyIcon} size={16} strokeWidth={2} />
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
                            <NavLink to={item.to} onClick={() => setOpenMobile(false)}>
                              {({ isActive }) => (
                                <SidebarMenuSubButton isActive={isActive} render={<span />}>
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
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
