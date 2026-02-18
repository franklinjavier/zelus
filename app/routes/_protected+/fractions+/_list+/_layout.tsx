import { data, href, Link, Outlet, useFetcher, useMatches, useNavigate } from 'react-router'
import { z } from 'zod'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  UserMultiple02Icon,
  Add01Icon,
  Building06Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import { listFractions } from '~/lib/services/fractions'
import { requestAssociation, getUserAssociatedFractionIds } from '~/lib/services/associations'
import { Button } from '~/components/ui/button'
import { CardLink } from '~/components/brand/card-link'
import { EmptyState } from '~/components/layout/empty-state'
import { setToast } from '~/lib/toast.server'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Frações — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const fractionsList = await listFractions(orgId)

  const isAdmin = effectiveRole === 'org_admin'
  const userAssociations = isAdmin
    ? new Map<string, string>()
    : await getUserAssociatedFractionIds(orgId, user.id)

  return {
    fractions: fractionsList,
    effectiveRole,
    userAssociations: Object.fromEntries(userAssociations),
  }
}

const requestSchema = z.object({
  intent: z.literal('request-association'),
  fractionId: z.string().min(1),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const parsed = requestSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  try {
    await requestAssociation(orgId, user.id, parsed.data.fractionId)
    return data({ success: true }, { headers: await setToast('Associação solicitada.') })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao solicitar associação.' }
  }
}

export default function FractionsLayout({ loaderData }: Route.ComponentProps) {
  const { fractions, effectiveRole, userAssociations } = loaderData
  const isAdmin = effectiveRole === 'org_admin'
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Frações</h1>
          <p className="text-muted-foreground text-sm">
            {fractions.length} {fractions.length === 1 ? 'fração' : 'frações'}
          </p>
        </div>
        {isAdmin && (
          <Button nativeButton={false} render={<Link to={href('/fractions/new')} />}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            Nova fração
          </Button>
        )}
      </div>

      {fractions.length === 0 ? (
        <EmptyState icon={Building06Icon} message="Nenhuma fração criada">
          {isAdmin && (
            <Button
              nativeButton={false}
              render={<Link to={href('/fractions/new')} />}
              variant="outline"
            >
              Criar primeira fração
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fractions.map((fraction) => (
            <FractionTile
              key={fraction.id}
              fraction={fraction}
              isAdmin={isAdmin}
              associationStatus={userAssociations[fraction.id] ?? null}
            />
          ))}
        </div>
      )}

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/fractions'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>Nova fração</DrawerTitle>
            <DrawerDescription>Preencha os dados para criar uma nova fração.</DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}

function FractionTile({
  fraction,
  isAdmin,
  associationStatus,
}: {
  fraction: {
    id: string
    label: string
    description: string | null
    memberCount: number
  }
  isAdmin: boolean
  associationStatus: string | null
}) {
  const fetcher = useFetcher()
  const isRequesting = fetcher.state !== 'idle'

  return (
    <CardLink to={href('/fractions/:id', { id: fraction.id })}>
      <div>
        <p className="font-medium">{fraction.label}</p>
        {fraction.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{fraction.description}</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <HugeiconsIcon icon={UserMultiple02Icon} size={14} strokeWidth={2} />
          {fraction.memberCount} {fraction.memberCount === 1 ? 'membro' : 'membros'}
        </span>
        {isAdmin ? (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={16}
            strokeWidth={2}
            className="text-muted-foreground"
          />
        ) : associationStatus === 'approved' ? (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={16}
            strokeWidth={2}
            className="text-muted-foreground"
          />
        ) : associationStatus === 'pending' ? (
          <span className="text-muted-foreground text-sm">Pendente</span>
        ) : (
          <fetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
            <input type="hidden" name="intent" value="request-association" />
            <input type="hidden" name="fractionId" value={fraction.id} />
            <Button
              type="submit"
              variant="outline"
              disabled={isRequesting}
              onClick={(e) => e.stopPropagation()}
            >
              {isRequesting ? 'A solicitar…' : 'Associar-me'}
            </Button>
          </fetcher.Form>
        )}
      </div>
    </CardLink>
  )
}
