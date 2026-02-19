import {
  Delete02Icon,
  Edit02Icon,
  UserAdd01Icon,
  UserMultiple02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useRef, useState } from 'react'
import { data, href, Link, Outlet, useFetcher, useMatches, useNavigate } from 'react-router'

import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { RoleBadge } from '~/components/shared/role-badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
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
import { getFractionRole } from '~/lib/auth/rbac'
import { getInitials } from '~/lib/format'
import {
  bulkAssignUsersToFraction,
  listFractionMembers,
  listOrgMembers,
  removeAssociation,
  updateMemberRole,
} from '~/lib/services/associations'
import { getFraction } from '~/lib/services/fractions'
import { setToast } from '~/lib/toast.server'
import type { Route } from './+types/_layout'

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.fraction?.label ?? 'Fração'
  return [{ title: `${label} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const fraction = await getFraction(orgId, params.id)

  if (!fraction) throw new Response('Not Found', { status: 404 })

  const isAdmin = effectiveRole === 'org_admin'
  const fractionRole = isAdmin ? null : await getFractionRole(orgId, user.id, params.id)
  const isMember = !!fractionRole

  const members = await listFractionMembers(orgId, params.id)
  const canInvite = isAdmin || fractionRole === 'fraction_owner_admin'
  const orgMembers = isAdmin ? await listOrgMembers(orgId) : []

  return { fraction, members, isAdmin, isMember, canInvite, orgMembers }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'change-role') {
    if (effectiveRole !== 'org_admin') {
      throw new Response('Forbidden', { status: 403 })
    }

    const associationId = formData.get('associationId') as string
    const role = formData.get('role') as string

    if (role !== 'fraction_owner_admin' && role !== 'fraction_member') {
      return { error: 'Papel inválido.' }
    }

    try {
      await updateMemberRole(orgId, associationId, role, user.id)
      return data({ success: true }, { headers: await setToast('Papel atualizado.') })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao alterar papel.'
      return data({ error: msg }, { headers: await setToast(msg, 'error') })
    }
  }

  if (intent === 'remove-member') {
    if (effectiveRole !== 'org_admin') {
      throw new Response('Forbidden', { status: 403 })
    }

    const associationId = formData.get('associationId') as string
    if (!associationId) return { error: 'Associação não especificada.' }

    try {
      await removeAssociation(orgId, associationId, user.id)
      return data({ success: true }, { headers: await setToast('Membro removido.') })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao remover membro.'
      return data({ error: msg }, { headers: await setToast(msg, 'error') })
    }
  }

  if (intent === 'bulk-assign-users') {
    if (effectiveRole !== 'org_admin') {
      throw new Response('Forbidden', { status: 403 })
    }

    const userIds = formData.getAll('userIds') as string[]
    if (userIds.length === 0) {
      return { error: 'Selecione pelo menos um membro.' }
    }

    const result = await bulkAssignUsersToFraction(orgId, params.id, userIds, user.id)
    return data(
      { success: true, ...result },
      {
        headers: await setToast(
          `${result.created} ${result.created === 1 ? 'membro associado' : 'membros associados'}.`,
        ),
      },
    )
  }

  return { error: 'Ação desconhecida.' }
}

export default function FractionDetailLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { fraction, members, isAdmin, isMember, canInvite, orgMembers } = loaderData
  const fetcher = useFetcher()
  const bulkFetcher = useFetcher()
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some(
    (m) => m.pathname.endsWith('/edit') || m.pathname.endsWith('/invite'),
  )

  const prevBulkStateRef = useRef(bulkFetcher.state)
  if (
    prevBulkStateRef.current !== 'idle' &&
    bulkFetcher.state === 'idle' &&
    bulkFetcher.data &&
    'success' in bulkFetcher.data
  ) {
    setBulkDrawerOpen(false)
  }
  prevBulkStateRef.current = bulkFetcher.state

  return (
    <div>
      <div className="flex items-center justify-between">
        <BackButton to={href('/fractions')} />
        {(isAdmin || canInvite) && (
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to={href('/fractions/:id/edit', { id: fraction.id })} />}
              >
                <HugeiconsIcon
                  icon={Edit02Icon}
                  data-icon="inline-start"
                  size={16}
                  strokeWidth={2}
                />
                Editar
              </Button>
            )}
            {canInvite && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to={href('/fractions/:id/invite', { id: fraction.id })} />}
              >
                <HugeiconsIcon
                  icon={UserAdd01Icon}
                  data-icon="inline-start"
                  size={16}
                  strokeWidth={2}
                />
                Convidar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">{fraction.label}</h1>
        {fraction.description && (
          <p className="text-muted-foreground mt-1 text-sm">{fraction.description}</p>
        )}
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      {!isAdmin && !isMember && (
        <div className="mt-4">
          <fetcher.Form method="post" action={href('/fractions')}>
            <input type="hidden" name="intent" value="request-association" />
            <input type="hidden" name="fractionId" value={fraction.id} />
            <Button type="submit" variant="outline">
              <HugeiconsIcon
                icon={UserAdd01Icon}
                data-icon="inline-start"
                size={16}
                strokeWidth={2}
              />
              Associar-me a esta fração
            </Button>
          </fetcher.Form>
        </div>
      )}

      <div className="mt-6">
        <MembersCard
          members={members}
          showEmail={isAdmin || isMember}
          canChangeRole={isAdmin}
          canRemove={isAdmin}
          onBulkAssign={isAdmin ? () => setBulkDrawerOpen(true) : undefined}
        />
      </div>

      {isAdmin && (
        <BulkAssignMembersDrawer
          open={bulkDrawerOpen}
          onOpenChange={setBulkDrawerOpen}
          orgMembers={orgMembers}
          assignedUserIds={
            new Set(
              members
                .filter((m) => m.status === 'approved' || m.status === 'pending')
                .map((m) => m.userId),
            )
          }
          fetcher={bulkFetcher}
        />
      )}

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/fractions/:id', { id: fraction.id }))
        }}
      >
        <DrawerPopup>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}

function MembersCard({
  members,
  showEmail = false,
  canChangeRole = false,
  canRemove = false,
  onBulkAssign,
}: {
  members: {
    id: string
    userName: string
    userEmail: string
    userImage: string | null
    role: string
    status: string
  }[]
  showEmail?: boolean
  canChangeRole?: boolean
  canRemove?: boolean
  onBulkAssign?: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Membros
          <span className="text-muted-foreground ml-1.5 font-normal">{members.length}</span>
        </h2>
        {onBulkAssign && (
          <Button variant="outline" size="sm" onClick={onBulkAssign}>
            <HugeiconsIcon
              icon={UserAdd01Icon}
              data-icon="inline-start"
              size={16}
              strokeWidth={2}
            />
            Associar membros
          </Button>
        )}
      </div>
      {members.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10">
          <div className="bg-muted flex size-12 items-center justify-center rounded-2xl">
            <HugeiconsIcon
              icon={UserMultiple02Icon}
              size={20}
              strokeWidth={1.5}
              className="text-muted-foreground"
            />
          </div>
          <p className="text-muted-foreground text-sm">Nenhum membro associado</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="ring-foreground/5 flex items-center gap-3 rounded-2xl p-3 ring-1"
            >
              <MemberAvatar name={m.userName} image={m.userImage} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.userName}</p>
                {showEmail && (
                  <p className="text-muted-foreground truncate text-sm">{m.userEmail}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canChangeRole && m.status === 'approved' ? (
                  <MemberRoleSelect associationId={m.id} currentRole={m.role} />
                ) : (
                  <RoleBadge role={m.role} />
                )}
                <StatusBadge status={m.status} />
                {canRemove && <RemoveMemberButton associationId={m.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberAvatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <Avatar className="size-9">
      {image && <AvatarImage src={image} alt={name} />}
      <AvatarFallback className="text-sm">{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return null
  if (status === 'pending') return <Badge variant="secondary">Pendente</Badge>
  return <Badge variant="destructive">Rejeitado</Badge>
}

function MemberRoleSelect({
  associationId,
  currentRole,
}: {
  associationId: string
  currentRole: string
}) {
  const fetcher = useFetcher()
  const hasError = fetcher.data && 'error' in fetcher.data
  const effectiveRole = hasError
    ? currentRole
    : ((fetcher.formData?.get('role') as string) ?? currentRole)

  return (
    <Select
      value={effectiveRole}
      items={fractionRoleItems}
      onValueChange={(value) => {
        if (value === currentRole) return
        fetcher.submit({ intent: 'change-role', associationId, role: value }, { method: 'post' })
      }}
    >
      <SelectTrigger className="h-8 gap-1 rounded-full px-2.5 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-48">
        {fractionRoleItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RemoveMemberButton({ associationId }: { associationId: string }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="remove-member" />
      <input type="hidden" name="associationId" value={associationId} />
      <Button type="submit" variant="destructive" size="icon-sm">
        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
        <span className="sr-only">Remover</span>
      </Button>
    </fetcher.Form>
  )
}

const fractionRoleItems = [
  { label: 'Membro', value: 'fraction_member' },
  { label: 'Admin da fração', value: 'fraction_owner_admin' },
]

function BulkAssignMembersDrawer({
  open,
  onOpenChange,
  orgMembers,
  assignedUserIds,
  fetcher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgMembers: { userId: string; userName: string; userEmail: string }[]
  assignedUserIds: Set<string>
  fetcher: ReturnType<typeof useFetcher>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const prevOpenRef = useRef(open)
  if (open && !prevOpenRef.current) {
    setSelected(new Set())
  }
  prevOpenRef.current = open

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const unassigned = orgMembers.filter((m) => !assignedUserIds.has(m.userId))

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle>Associar membros</DrawerTitle>
          <DrawerDescription>
            Selecione membros do condomínio para associar a esta fração.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-6">
          {unassigned.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todos os membros do condomínio já estão associados.
            </p>
          ) : (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="bulk-assign-users" />
              <div className="flex flex-col gap-1.5">
                {unassigned.map((m) => (
                  <label
                    key={m.userId}
                    htmlFor={`bulk-user-${m.userId}`}
                    className="ring-foreground/5 hover:bg-muted/50 flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors"
                  >
                    <Checkbox
                      id={`bulk-user-${m.userId}`}
                      name="userIds"
                      value={m.userId}
                      checked={selected.has(m.userId)}
                      onCheckedChange={() => toggle(m.userId)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{m.userName}</p>
                      <p className="text-muted-foreground truncate text-sm">{m.userEmail}</p>
                    </div>
                  </label>
                ))}
              </div>
              <Button type="submit" className="mt-4 w-full" disabled={selected.size === 0}>
                Associar ({selected.size})
              </Button>
            </fetcher.Form>
          )}
        </div>
      </DrawerPopup>
    </Drawer>
  )
}
