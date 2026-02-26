import { and, eq } from 'drizzle-orm'
import { Building06Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import {
  data,
  href,
  Link,
  Outlet,
  redirect,
  useFetcher,
  useMatches,
  useNavigate,
} from 'react-router'

import type { Route } from './+types/_layout'
import { userContext, orgContext } from '~/lib/auth/context'
import { auth } from '~/lib/auth/auth.server'
import { db } from '~/lib/db'
import { member, organization } from '~/lib/db/schema'
import { setToast } from '~/lib/toast.server'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/layout/empty-state'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { Input } from '~/components/ui/input'

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)
  const { orgId } = context.get(orgContext)

  const userOrgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      city: organization.city,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, user.id))

  return { orgs: userOrgs, activeOrgId: orgId }
}

function appendSetCookies(headers: Headers, response: Response) {
  for (const cookie of response.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext)
  const { orgId: activeOrgId } = context.get(orgContext)
  const formData = await request.formData()

  if (String(formData.get('intent') || '') !== 'delete-org') {
    return data({ error: 'Ação inválida.' }, { status: 400 })
  }

  const organizationId = String(formData.get('organizationId') || '')
  const confirmName = String(formData.get('confirmName') || '')

  if (!organizationId) {
    return data({ error: 'Condomínio inválido.' }, { status: 400 })
  }

  const orgMembership = await db
    .select({
      id: organization.id,
      name: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(member.userId, user.id), eq(member.organizationId, organizationId)))
    .limit(1)
    .then((rows) => rows[0])

  if (!orgMembership) {
    return data({ error: 'Condomínio não encontrado.', organizationId }, { status: 404 })
  }

  if (!(orgMembership.role === 'owner' || orgMembership.role === 'admin')) {
    return data(
      { error: 'Só administradores podem apagar condomínios.', organizationId },
      { status: 403 },
    )
  }

  if (confirmName !== orgMembership.name) {
    return data(
      {
        error: `Digite exatamente o nome do condomínio (${orgMembership.name}) para confirmar.`,
        organizationId,
      },
      { status: 400 },
    )
  }

  const deleteRes = await auth.api.deleteOrganization({
    body: { organizationId },
    asResponse: true,
    headers: request.headers,
  })

  if (!deleteRes.ok) {
    const body = await deleteRes.json().catch(() => null)
    return data(
      {
        error: body?.message || 'Não foi possível apagar o condomínio.',
        organizationId,
      },
      { status: 400 },
    )
  }

  const headers = new Headers()
  appendSetCookies(headers, deleteRes)

  if (organizationId === activeOrgId) {
    const nextOrg = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, user.id))
      .limit(1)
      .then((rows) => rows[0])

    if (nextOrg) {
      const switchRes = await auth.api.setActiveOrganization({
        body: { organizationId: nextOrg.organizationId },
        asResponse: true,
        headers: request.headers,
      })
      appendSetCookies(headers, switchRes)
    }
  }

  headers.append('set-cookie', (await setToast('Condomínio apagado.'))['set-cookie'])

  throw redirect(href('/orgs'), { headers })
}

export default function OrgsLayout({ loaderData }: Route.ComponentProps) {
  const { orgs, activeOrgId } = loaderData
  const fetcher = useFetcher()
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  if (orgs.length === 0) {
    return (
      <>
        <EmptyState icon={Building06Icon} message="Nenhum condomínio encontrado">
          <Button render={<Link to={href('/orgs/new')} />} nativeButton={false}>
            Criar condomínio
          </Button>
        </EmptyState>

        <Drawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            if (!open) navigate(href('/orgs'))
          }}
        >
          <DrawerPopup>
            <DrawerHeader>
              <DrawerTitle>Novo condomínio</DrawerTitle>
              <DrawerDescription>
                Preencha os dados para criar um novo condomínio.
              </DrawerDescription>
            </DrawerHeader>
            <Outlet />
          </DrawerPopup>
        </Drawer>
      </>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Condomínios</h1>
        <Button render={<Link to={href('/orgs/new')} />} nativeButton={false} size="sm">
          <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
          Criar condomínio
        </Button>
      </div>

      <ul className="mt-6 grid gap-3">
        {orgs.map((org) => {
          const isActive = org.id === activeOrgId
          const canDelete = org.role === 'owner' || org.role === 'admin'

          return (
            <li
              key={org.id}
              className="bg-card ring-foreground/10 flex items-center gap-4 rounded-2xl p-4 ring-1"
            >
              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                <HugeiconsIcon
                  icon={Building06Icon}
                  size={20}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{org.name}</p>
                {org.city && <p className="text-muted-foreground truncate text-sm">{org.city}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isActive ? (
                  <span className="text-primary text-sm font-medium">Ativo</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fetcher.submit(
                        { organizationId: org.id },
                        { method: 'post', action: href('/api/switch-org') },
                      )
                    }}
                  >
                    Mudar
                  </Button>
                )}
                {canDelete && <DeleteOrgButton orgId={org.id} orgName={org.name} />}
              </div>
            </li>
          )
        })}
      </ul>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/orgs'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>Novo condomínio</DrawerTitle>
            <DrawerDescription>Preencha os dados para criar um novo condomínio.</DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}

function DeleteOrgButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const fetcher = useFetcher<{ error?: string; organizationId?: string }>()
  const [confirmName, setConfirmName] = useState('')
  const isDeleting = fetcher.state !== 'idle'
  const matchesName = confirmName === orgName
  const error =
    fetcher.data?.organizationId === orgId || !fetcher.data?.organizationId
      ? fetcher.data?.error
      : null

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" size="sm" disabled={isDeleting} />}
      >
        Apagar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar condomínio?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente e remove o condomínio e respetivos dados associados. Para
            confirmar, digite o nome do condomínio abaixo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <fetcher.Form method="post" className="grid gap-3">
          <input type="hidden" name="intent" value="delete-org" />
          <input type="hidden" name="organizationId" value={orgId} />

          <div className="grid gap-1.5">
            <label htmlFor={`confirm-org-${orgId}`} className="text-sm font-medium">
              Nome do condomínio
            </label>
            <Input
              id={`confirm-org-${orgId}`}
              name="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.currentTarget.value)}
              placeholder={orgName}
              autoComplete="off"
              required
            />
            <p className="text-muted-foreground text-xs">
              Digite exatamente: <span className="font-mono">{orgName}</span>
            </p>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmName('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={!matchesName || isDeleting}>
              {isDeleting ? 'A apagar…' : 'Apagar condomínio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </fetcher.Form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
