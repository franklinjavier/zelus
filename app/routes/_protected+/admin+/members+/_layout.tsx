import { UserMultiple02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href, Link, Outlet, useMatches, useNavigate } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { roleLabel } from '~/components/shared/role-badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from '~/components/ui/drawer'
import { orgContext } from '~/lib/auth/context'
import { getInitials } from '~/lib/format'
import { listOrgMembers } from '~/lib/services/associations'
import type { Route } from './+types/_layout'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Membros — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const members = await listOrgMembers(orgId)
  return { members }
}

export default function MembersLayout({ loaderData }: Route.ComponentProps) {
  const { members } = loaderData
  const navigate = useNavigate()
  const matches = useMatches()
  const drawerMatch = matches.find((m) => m.params.userId)
  const isDrawerOpen = !!drawerMatch
  const selectedMember = drawerMatch
    ? members.find((m) => m.userId === drawerMatch.params.userId)
    : null

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Membros</h1>

      <div className="mt-6">
        {members.length === 0 ? (
          <EmptyState icon={UserMultiple02Icon} message="Nenhum membro no condomínio" />
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <Link
                key={m.userId}
                to={href('/admin/members/:userId', { userId: m.userId })}
                className="block"
              >
                <div className="ring-foreground/5 hover:bg-muted/50 flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors">
                  <Avatar className="size-9">
                    {m.userImage && <AvatarImage src={m.userImage} alt={m.userName} />}
                    <AvatarFallback className="text-sm">{getInitials(m.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.userName}</p>
                    <p className="text-muted-foreground truncate text-sm">{m.userEmail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(m.orgRole === 'owner' || m.orgRole === 'admin') && (
                      <Badge variant="secondary">{roleLabel('org_admin')}</Badge>
                    )}
                    <span className="text-muted-foreground text-sm">
                      {m.fractionCount} {m.fractionCount === 1 ? 'fração' : 'frações'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/admin/members'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>{selectedMember?.userName ?? 'Membro'}</DrawerTitle>
            <DrawerDescription>Gerir frações associadas</DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}
