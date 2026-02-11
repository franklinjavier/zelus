import { Link, useFetcher } from 'react-router'
import { z } from 'zod'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  UserMultiple02Icon,
  Add01Icon,
  Building06Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/index'
import { orgContext, userContext } from '~/lib/auth/context'
import { listFractions } from '~/lib/services/fractions'
import { requestAssociation } from '~/lib/services/associations'
import { Button } from '~/components/ui/button'
import { CardLink } from '~/components/brand/card-link'
import { EmptyState } from '~/components/layout/empty-state'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Frações — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const fractionsList = await listFractions(orgId)

  return { fractions: fractionsList, effectiveRole }
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
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao solicitar associação.' }
  }
}

export default function FractionsPage({ loaderData }: Route.ComponentProps) {
  const { fractions, effectiveRole } = loaderData
  const isAdmin = effectiveRole === 'org_admin'

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
          <Button render={<Link to="/fractions/new" />}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            Nova fração
          </Button>
        )}
      </div>

      {fractions.length === 0 ? (
        <EmptyState icon={Building06Icon} message="Nenhuma fração criada">
          {isAdmin && (
            <Button render={<Link to="/fractions/new" />} variant="outline">
              Criar primeira fração
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fractions.map((fraction) => (
            <FractionTile key={fraction.id} fraction={fraction} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}

function FractionTile({
  fraction,
  isAdmin,
}: {
  fraction: {
    id: string
    label: string
    description: string | null
    memberCount: number
  }
  isAdmin: boolean
}) {
  const fetcher = useFetcher()
  const isRequesting = fetcher.state !== 'idle'

  return (
    <CardLink to={`/fractions/${fraction.id}`}>
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
        {!isAdmin ? (
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
        ) : (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={16}
            strokeWidth={2}
            className="text-muted-foreground"
          />
        )}
      </div>
    </CardLink>
  )
}
