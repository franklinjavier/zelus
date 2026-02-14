import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useFetcher } from 'react-router'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '~/components/ui/sidebar'

type Org = { id: string; name: string }

export function OrgSwitcher({ org, orgs }: { org: Org; orgs: Org[] }) {
  const fetcher = useFetcher()

  if (orgs.length <= 1) {
    return <span className="truncate text-sm font-semibold tracking-tight">{org.name}</span>
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton className="h-auto px-1 py-0.5">
                <span className="truncate text-sm font-semibold tracking-tight">{org.name}</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  strokeWidth={2}
                  className="text-muted-foreground ml-auto shrink-0"
                />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
            {orgs.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onSelect={() => {
                  if (o.id !== org.id) {
                    fetcher.submit(
                      { organizationId: o.id },
                      { method: 'post', action: '/api/switch-org' },
                    )
                  }
                }}
              >
                <span className="flex-1 truncate">{o.name}</span>
                {o.id === org.id && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={16}
                    strokeWidth={2}
                    className="text-primary ml-auto shrink-0"
                  />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
