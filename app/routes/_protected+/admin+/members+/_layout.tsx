import { UserMultiple02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { data, href, Link, Outlet, useFetcher, useMatches, useNavigate } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from '~/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { orgContext, userContext } from '~/lib/auth/context'
import { getInitials } from '~/lib/format'
import { listOrgMembers, updateOrgMemberRole } from '~/lib/services/associations.server'
import { setToast } from '~/lib/toast.server'
import type { Route } from './+types/_layout'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Membros — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const currentUser = context.get(userContext)
  const members = await listOrgMembers(orgId)
  return { members, currentUserId: currentUser.id }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const admin = context.get(userContext)

  if (effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'change-org-role') {
    const memberId = formData.get('memberId') as string
    const role = formData.get('role') as string

    if (role !== 'admin' && role !== 'member') {
      return data(
        { error: 'Papel inválido.' },
        { headers: await setToast('Papel inválido.', 'error') },
      )
    }

    try {
      await updateOrgMemberRole(orgId, memberId, role, admin.id)
      return data({ success: true }, { headers: await setToast('Papel atualizado.') })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao alterar papel.'
      return data({ error: msg }, { headers: await setToast(msg, 'error') })
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function MembersLayout({ loaderData }: Route.ComponentProps) {
  const { members, currentUserId } = loaderData
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
          <div className="@container flex flex-col gap-2">
            {members.map((m) => (
              <Link
                key={m.userId}
                to={href('/admin/members/:userId', { userId: m.userId })}
                className="block"
              >
                <div className="ring-foreground/5 hover:bg-muted/50 flex items-start gap-3 rounded-2xl p-3 ring-1 transition-colors @sm:items-center">
                  <Avatar className="size-9">
                    {m.userImage && <AvatarImage src={m.userImage} alt={m.userName} />}
                    <AvatarFallback className="text-sm">{getInitials(m.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.userName}</p>
                    <p className="text-muted-foreground text-sm [overflow-wrap:anywhere] @sm:truncate">
                      {m.userEmail}
                    </p>
                    <div className="mt-1 flex items-center gap-2 @sm:hidden">
                      <OrgRoleBadgeOrSelect
                        memberId={m.memberId}
                        orgRole={m.orgRole}
                        isSelf={m.userId === currentUserId}
                      />
                      <span className="text-muted-foreground text-sm">
                        {m.fractionCount} {m.fractionCount === 1 ? 'fração' : 'frações'}
                      </span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 @sm:flex">
                    <OrgRoleBadgeOrSelect
                      memberId={m.memberId}
                      orgRole={m.orgRole}
                      isSelf={m.userId === currentUserId}
                    />
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

const orgRoleItems = [
  { label: 'Membro', value: 'member' },
  { label: 'Admin', value: 'admin' },
]

function OrgRoleBadgeOrSelect({
  memberId,
  orgRole,
  isSelf,
}: {
  memberId: string
  orgRole: string
  isSelf: boolean
}) {
  if (orgRole === 'owner') {
    return <Badge variant="secondary">Proprietário</Badge>
  }

  if (isSelf) {
    return orgRole === 'admin' ? <Badge variant="secondary">Admin</Badge> : null
  }

  return <OrgRoleSelect memberId={memberId} currentRole={orgRole} />
}

function OrgRoleSelect({ memberId, currentRole }: { memberId: string; currentRole: string }) {
  const fetcher = useFetcher()
  const hasError = fetcher.data && 'error' in fetcher.data
  const effectiveRole = hasError
    ? currentRole
    : ((fetcher.formData?.get('role') as string) ?? currentRole)

  return (
    <Select
      value={effectiveRole}
      items={orgRoleItems}
      onValueChange={(value) => {
        if (value === currentRole) return
        fetcher.submit({ intent: 'change-org-role', memberId, role: value }, { method: 'post' })
      }}
    >
      <SelectTrigger
        className="h-8 gap-1 rounded-full px-2.5 text-sm"
        onClick={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-48">
        {orgRoleItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
