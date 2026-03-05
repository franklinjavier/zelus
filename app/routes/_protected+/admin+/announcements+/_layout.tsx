import { data, Form, Link, Outlet, useMatches, useNavigate, useFetcher, href } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  listAnnouncementsAdmin,
  deleteAnnouncement,
  archiveAnnouncement,
  unarchiveAnnouncement,
  pauseAnnouncement,
  resumeAnnouncement,
} from '~/lib/services/announcements.server'
import { getNextOccurrence, type Recurrence } from '~/lib/announcements/recurrence'
import { formatDate } from '~/lib/format'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { ErrorBanner } from '~/components/layout/feedback'
import { EmptyState } from '~/components/layout/empty-state'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { setToast } from '~/lib/toast.server'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Avisos — Zelus' }]
}

function getFrequencyLabel(recurrence: Recurrence | null): string | null {
  if (!recurrence) return null
  if (recurrence.frequency === 'weekly') {
    return recurrence.interval === 1 ? 'Semanal' : `A cada ${recurrence.interval} semanas`
  }
  return recurrence.interval === 1 ? 'Mensal' : `A cada ${recurrence.interval} meses`
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const rows = await listAnnouncementsAdmin(orgId)
  const now = new Date()

  const enriched = rows.map((row) => {
    const recurrence = row.recurrence as Recurrence | null
    const nextOccurrence = getNextOccurrence(row.eventDate, recurrence, now)
    const frequencyLabel = getFrequencyLabel(recurrence)
    return {
      ...row,
      nextOccurrence: nextOccurrence?.toISOString() ?? null,
      frequencyLabel,
      isArchived: !!row.archivedAt,
      isPaused: !!row.pausedAt,
    }
  })

  const active = enriched.filter((a) => !a.isArchived && !a.isPaused)
  const paused = enriched.filter((a) => !a.isArchived && a.isPaused)
  const archived = enriched.filter((a) => a.isArchived)

  return { active, paused, archived }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))
  const id = String(formData.get('id'))

  try {
    switch (intent) {
      case 'delete':
        await deleteAnnouncement(orgId, id, user.id)
        return data({ success: true }, { headers: await setToast('Aviso apagado.') })
      case 'archive':
        await archiveAnnouncement(orgId, id, user.id)
        return data({ success: true }, { headers: await setToast('Aviso arquivado.') })
      case 'unarchive':
        await unarchiveAnnouncement(orgId, id, user.id)
        return data({ success: true }, { headers: await setToast('Aviso restaurado.') })
      case 'pause':
        await pauseAnnouncement(orgId, id, user.id)
        return data({ success: true }, { headers: await setToast('Aviso pausado.') })
      case 'resume':
        await resumeAnnouncement(orgId, id, user.id)
        return data({ success: true }, { headers: await setToast('Aviso retomado.') })
      default:
        return { error: 'Acao desconhecida.' }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao processar acao.' }
  }
}

type EnrichedAnnouncement = Awaited<ReturnType<typeof loader>>['active'][number]

function AnnouncementItem({ item }: { item: EnrichedAnnouncement }) {
  const fetcher = useFetcher({ key: `announcement-${item.id}` })
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <div
      className={`ring-foreground/5 flex items-center gap-3 rounded-2xl p-3 ring-1 ${isSubmitting ? 'opacity-60' : ''}`}
    >
      <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
        <HugeiconsIcon icon={Calendar03Icon} size={18} strokeWidth={1.5} className="text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={href('/admin/announcements/:id', { id: item.id })}
            className="truncate text-sm font-medium hover:underline"
          >
            {item.title}
          </Link>
          {item.frequencyLabel && (
            <Badge variant="secondary" className="shrink-0">
              {item.frequencyLabel}
            </Badge>
          )}
        </div>
        {item.nextOccurrence && (
          <p className="text-muted-foreground text-sm">{formatDate(item.nextOccurrence)}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!item.isArchived && (
          <fetcher.Form method="post">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="intent" value={item.isPaused ? 'resume' : 'pause'} />
            <Button type="submit" variant="ghost" size="sm" disabled={isSubmitting}>
              {item.isPaused ? 'Retomar' : 'Pausar'}
            </Button>
          </fetcher.Form>
        )}

        <fetcher.Form method="post">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="intent" value={item.isArchived ? 'unarchive' : 'archive'} />
          <Button type="submit" variant="ghost" size="sm" disabled={isSubmitting}>
            {item.isArchived ? 'Restaurar' : 'Arquivar'}
          </Button>
        </fetcher.Form>

        <DeleteConfirmDialog
          title="Apagar aviso?"
          description={`O aviso "${item.title}" sera removido permanentemente.`}
        >
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={item.id} />
            <AlertDialogAction type="submit">Apagar</AlertDialogAction>
          </Form>
        </DeleteConfirmDialog>
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  items,
}: {
  title: string
  count: number
  items: EnrichedAnnouncement[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h2 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">({count})</span>
      </h2>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <AnnouncementItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

export default function AnnouncementsLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { active, paused, archived } = loaderData
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some(
    (m) => m.pathname.endsWith('/new') || /\/announcements\/[^/]+$/.test(m.pathname),
  )

  const isEmpty = active.length === 0 && paused.length === 0 && archived.length === 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Avisos</h1>
        <Button nativeButton={false} render={<Link to={href('/admin/announcements/new')} />}>
          Novo aviso
        </Button>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {isEmpty ? (
          <EmptyState icon={Calendar03Icon} message="Nenhum aviso criado" />
        ) : (
          <>
            <Section title="Ativos" count={active.length} items={active} />
            <Section title="Pausados" count={paused.length} items={paused} />
            <Section title="Arquivados" count={archived.length} items={archived} />
          </>
        )}
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/admin/announcements'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>
              {matches.some((m) => m.pathname.endsWith('/new')) ? 'Novo aviso' : 'Editar aviso'}
            </DrawerTitle>
            <DrawerDescription>
              {matches.some((m) => m.pathname.endsWith('/new'))
                ? 'Crie um novo aviso para os moradores.'
                : 'Edite os detalhes do aviso.'}
            </DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}
