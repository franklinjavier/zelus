import { data, useFetcher } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle01Icon, UserIcon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/associations'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  listPendingAssociations,
  approveAssociation,
  rejectAssociation,
} from '~/lib/services/associations'
import { setToast } from '~/lib/toast.server'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { EmptyState } from '~/components/layout/empty-state'
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

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Pedidos de acesso — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const associations = await listPendingAssociations(orgId)
  return { associations }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')
  const associationId = formData.get('associationId') as string

  if (!associationId) return { error: 'ID da associação é obrigatório.' }

  try {
    if (intent === 'approve') {
      await approveAssociation(orgId, associationId, user.id)
      return data({ success: true }, { headers: await setToast('Associação aprovada.') })
    }
    if (intent === 'reject') {
      await rejectAssociation(orgId, associationId, user.id)
      return data({ success: true }, { headers: await setToast('Associação rejeitada.') })
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao processar associação.' }
  }

  return { error: 'Ação desconhecida.' }
}

export default function AssociationsPage({ loaderData }: Route.ComponentProps) {
  const { associations } = loaderData

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Pedidos de acesso</h1>
      <div className="mt-6">
        <AssociationsList associations={associations} />
      </div>
    </div>
  )
}

function AssociationsList({
  associations,
}: {
  associations: Awaited<ReturnType<typeof listPendingAssociations>>
}) {
  if (associations.length === 0) {
    return <EmptyState icon={CheckmarkCircle01Icon} message="Nenhum pedido de acesso pendente" />
  }

  return (
    <div className="flex flex-col gap-3">
      {associations.map((assoc) => (
        <AssociationRow key={assoc.id} association={assoc} />
      ))}
    </div>
  )
}

function AssociationRow({
  association,
}: {
  association: {
    id: string
    userName: string
    userEmail: string
    fractionLabel: string
    role: string
    createdAt: Date
  }
}) {
  const fetcher = useFetcher()
  const isProcessing = fetcher.state !== 'idle'

  return (
    <div className="bg-primary/5 ring-primary/10 hover:bg-primary/10 flex items-center justify-between gap-4 rounded-2xl p-5 ring-1 transition-colors">
      <div className="flex min-w-0 items-center gap-4">
        <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
          <HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.5} className="text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{association.userName}</p>
            <Badge variant="outline">{association.fractionLabel}</Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">{association.userEmail}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={isProcessing} />}>
            Rejeitar
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar associação?</AlertDialogTitle>
              <AlertDialogDescription>
                A associação de {association.userName} à fração {association.fractionLabel} será
                rejeitada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="reject" />
                <input type="hidden" name="associationId" value={association.id} />
                <AlertDialogAction type="submit">Rejeitar</AlertDialogAction>
              </fetcher.Form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="approve" />
          <input type="hidden" name="associationId" value={association.id} />
          <Button type="submit" disabled={isProcessing}>
            Aprovar
          </Button>
        </fetcher.Form>
      </div>
    </div>
  )
}
