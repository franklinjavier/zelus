import { useState } from 'react'
import { data, href, useFetcher } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon } from '@hugeicons/core-free-icons'

import { ErrorBanner } from '~/components/layout/feedback'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  bulkAssignFractionsToUser,
  getUserAssociatedFractionIds,
  removeAssociation,
} from '~/lib/services/associations.server'
import { listFractions } from '~/lib/services/fractions.server'
import { setToast } from '~/lib/toast.server'
import type { Route } from './+types/$userId'
import { db } from '~/lib/db'
import { userFractions } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const [fractionsList, associatedMap, associations] = await Promise.all([
    listFractions(orgId),
    getUserAssociatedFractionIds(orgId, params.userId),
    db
      .select({ id: userFractions.id, fractionId: userFractions.fractionId })
      .from(userFractions)
      .where(and(eq(userFractions.orgId, orgId), eq(userFractions.userId, params.userId))),
  ])

  const assocByFraction = new Map(associations.map((a) => [a.fractionId, a.id]))

  const fractions = fractionsList.map((f) => ({
    id: f.id,
    label: f.label,
    status: associatedMap.get(f.id) ?? null,
    associationId: assocByFraction.get(f.id) ?? null,
  }))

  return { fractions }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const admin = context.get(userContext)

  if (effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'bulk-assign-fractions') {
    const fractionIds = formData.getAll('fractionIds') as string[]
    if (fractionIds.length === 0) {
      return { error: 'Selecione pelo menos uma fração.' }
    }

    const result = await bulkAssignFractionsToUser(orgId, params.userId, fractionIds, admin.id)
    return data(
      { success: true, ...result },
      {
        headers: await setToast(
          `${result.created} ${result.created === 1 ? 'fração associada' : 'frações associadas'}.`,
        ),
      },
    )
  }

  if (intent === 'unassign-fraction') {
    const associationId = formData.get('associationId') as string
    if (!associationId) return { error: 'Associação não especificada.' }

    try {
      await removeAssociation(orgId, associationId, admin.id)
      return data({ success: true }, { headers: await setToast('Fração desassociada.') })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao desassociar fração.'
      return data({ error: msg }, { headers: await setToast(msg, 'error') })
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function MemberDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { fractions } = loaderData
  const fetcher = useFetcher()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const assigned = fractions.filter((f) => f.status === 'approved' || f.status === 'pending')
  const unassigned = fractions.filter((f) => f.status !== 'approved' && f.status !== 'pending')

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="px-6 pb-6">
      {actionData && 'error' in actionData && (
        <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
      )}

      {assigned.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium">Frações associadas</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {assigned.map((f) => (
              <div
                key={f.id}
                className="ring-foreground/5 flex items-center gap-3 rounded-2xl p-3 ring-1"
              >
                <Checkbox checked disabled />
                <span className="flex-1 text-sm">{f.label}</span>
                {f.associationId && <UnassignButton associationId={f.associationId} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {unassigned.length > 0 ? (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="bulk-assign-fractions" />
          <h3 className="text-sm font-medium">Frações disponíveis</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {unassigned.map((f) => (
              <label
                key={f.id}
                className="ring-foreground/5 hover:bg-muted/50 flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors"
              >
                <Checkbox
                  name="fractionIds"
                  value={f.id}
                  checked={selected.has(f.id)}
                  onCheckedChange={() => toggle(f.id)}
                />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={selected.size === 0}>
            Associar ({selected.size})
          </Button>
        </fetcher.Form>
      ) : (
        <p className="text-muted-foreground text-sm">
          Este membro já está associado a todas as frações.
        </p>
      )}
    </div>
  )
}

function UnassignButton({ associationId }: { associationId: string }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="unassign-fraction" />
      <input type="hidden" name="associationId" value={associationId} />
      <Button type="submit" variant="destructive" size="icon-sm">
        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
        <span className="sr-only">Remover</span>
      </Button>
    </fetcher.Form>
  )
}
