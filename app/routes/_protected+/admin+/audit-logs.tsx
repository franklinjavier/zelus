import { CheckmarkCircle01Icon, FilterHorizontalIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href, Link } from 'react-router'

import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  PopoverPopup,
  PopoverPositioner,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from '~/components/ui/popover'
import { EmptyState } from '~/components/layout/empty-state'
import { orgContext } from '~/lib/auth/context'
import { formatDate } from '~/lib/format'
import { listAuditLogs, getAuditLogFilterOptions } from '~/lib/services/audit.server'
import { useFilterParams } from '~/lib/use-filter-params'
import { cn } from '~/lib/utils'
import type { Route } from './+types/audit-logs'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Logs — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const limit = 50
  const filters = {
    entityType: url.searchParams.get('entityType') || undefined,
    action: url.searchParams.get('action') || undefined,
    userId: url.searchParams.get('userId') || undefined,
  }

  const [{ rows, total }, filterOptions] = await Promise.all([
    listAuditLogs(orgId, filters, limit, (page - 1) * limit),
    getAuditLogFilterOptions(orgId),
  ])

  return { logs: rows, total, page, limit, filterOptions }
}

const actionLabels: Record<string, string> = {
  'ticket.created': 'Ocorrência criada',
  'ticket.updated': 'Ocorrência atualizada',
  'ticket.deleted': 'Ocorrência apagada',
  'ticket.status_changed': 'Estado da ocorrência alterado',
  'ticket.imported': 'Ocorrência importada',
  'ticket.comment_added': 'Comentário adicionado',
  'ticket.attachment_uploaded': 'Anexo carregado',
  'ticket.attachment_deleted': 'Anexo apagado',
  'supplier.created': 'Prestador criado',
  'supplier.updated': 'Prestador atualizado',
  'supplier.deleted': 'Prestador apagado',
  'maintenance.created': 'Intervenção criada',
  'maintenance.updated': 'Intervenção atualizada',
  'maintenance.deleted': 'Intervenção apagada',
  'member.role_changed': 'Papel de membro alterado',
  'member.removed': 'Membro removido',
  'invite.created': 'Convite criado',
  'invite.revoked': 'Convite revogado',
  'invite.accepted': 'Convite aceite',
  'association.requested': 'Associação pedida',
  'association.approved': 'Associação aprovada',
  'association.rejected': 'Associação rejeitada',
  'association.role_changed': 'Papel de associação alterado',
  'association.removed': 'Associação removida',
  'association.bulk_assigned': 'Associações em massa',
  'fraction.created': 'Fração criada',
  'fraction.updated': 'Fração atualizada',
  'fraction.deleted': 'Fração apagada',
  'category.created': 'Categoria criada',
  'category.deleted': 'Categoria apagada',
  'document.created': 'Documento criado',
  'document.deleted': 'Documento apagado',
  'contact.created': 'Contacto criado',
  'contact.updated': 'Contacto atualizado',
  'contact.deleted': 'Contacto apagado',
  'contact.linked': 'Contacto associado',
  'contact.unlinked': 'Contacto desassociado',
}

const entityTypeLabels: Record<string, string> = {
  ticket: 'Ocorrência',
  supplier: 'Prestador',
  maintenance_record: 'Intervenção',
  member: 'Membro',
  invite: 'Convite',
  association: 'Associação',
  organization: 'Condomínio',
  fraction: 'Fração',
  ticket_comment: 'Comentário',
  ticket_attachment: 'Anexo',
  user_fraction: 'Associação',
  fraction_contact: 'Contacto',
  document: 'Documento',
  category: 'Categoria',
  user: 'Utilizador',
}

export default function AuditLogsPage({ loaderData }: Route.ComponentProps) {
  const { logs, total, page, limit, filterOptions } = loaderData
  const { searchParams, setFilter } = useFilterParams()
  const totalPages = Math.ceil(total / limit)

  const activeFilterCount =
    (searchParams.get('entityType') ? 1 : 0) +
    (searchParams.get('action') ? 1 : 0) +
    (searchParams.get('userId') ? 1 : 0)

  const entityTypeItems = [
    { label: 'Todos os tipos', value: '_all' },
    ...filterOptions.entityTypes.map((v) => ({
      label: entityTypeLabels[v] ?? v,
      value: v,
    })),
  ]

  const actionItems = [
    { label: 'Todas as ações', value: '_all' },
    ...filterOptions.actions.map((v) => ({
      label: actionLabels[v] ?? v,
      value: v,
    })),
  ]

  const userItems = [
    { label: 'Todos os utilizadores', value: '_all' },
    ...filterOptions.users.map((u) => ({ label: u.name, value: u.id })),
  ]

  return (
    <div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Logs</h1>
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? 'registo' : 'registos'}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Mobile: filter popover */}
        <PopoverRoot>
          <PopoverTrigger
            className={cn(
              'ring-foreground/10 hover:bg-muted/50 relative inline-flex h-8 items-center gap-2 rounded-4xl px-3 text-sm font-medium ring-1 sm:hidden',
            )}
          >
            <HugeiconsIcon icon={FilterHorizontalIcon} size={16} />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 size-5 justify-center rounded-full p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverPositioner sideOffset={8}>
              <PopoverPopup className="w-72">
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-medium">Filtros</p>
                  <FilterSelect
                    items={entityTypeItems}
                    value={searchParams.get('entityType') ?? '_all'}
                    onChange={(v) => setFilter('entityType', v)}
                  />
                  <FilterSelect
                    items={actionItems}
                    value={searchParams.get('action') ?? '_all'}
                    onChange={(v) => setFilter('action', v)}
                  />
                  <FilterSelect
                    items={userItems}
                    value={searchParams.get('userId') ?? '_all'}
                    onChange={(v) => setFilter('userId', v)}
                  />
                </div>
              </PopoverPopup>
            </PopoverPositioner>
          </PopoverPortal>
        </PopoverRoot>

        {/* Desktop: inline filters */}
        <div className="hidden items-center gap-3 sm:flex">
          <FilterSelect
            items={entityTypeItems}
            value={searchParams.get('entityType') ?? '_all'}
            onChange={(v) => setFilter('entityType', v)}
            className="w-auto"
          />
          <FilterSelect
            items={actionItems}
            value={searchParams.get('action') ?? '_all'}
            onChange={(v) => setFilter('action', v)}
            className="w-auto"
          />
          <FilterSelect
            items={userItems}
            value={searchParams.get('userId') ?? '_all'}
            onChange={(v) => setFilter('userId', v)}
            className="w-auto"
          />
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={CheckmarkCircle01Icon} message="Nenhum registo encontrado" />
      ) : (
        <div className="mt-6 flex flex-col">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setFilter('page', String(page - 1))}
            className="text-muted-foreground hover:text-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setFilter('page', String(page + 1))}
            className="text-muted-foreground hover:text-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Seguinte
          </button>
        </div>
      )}
    </div>
  )
}

const statusLabels: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em progresso',
  resolved: 'Resolvida',
  closed: 'Fechada',
}

const statusColors: Record<string, string> = {
  open: 'bg-primary/15 text-primary',
  in_progress: 'bg-amber-500/15 text-amber-600',
  resolved: 'bg-emerald-500/15 text-emerald-600',
  closed: 'bg-muted-foreground/15 text-muted-foreground',
}

function getEntityLink(
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> | null,
) {
  if (entityType === 'ticket' && entityId) {
    return href('/tickets/:id', { id: entityId })
  }
  if (
    (entityType === 'ticket_comment' || entityType === 'ticket_attachment') &&
    metadata?.ticketId
  ) {
    return href('/tickets/:id', { id: metadata.ticketId as string })
  }
  if (entityType === 'supplier' && entityId) {
    return href('/suppliers/:id', { id: entityId })
  }
  if (entityType === 'maintenance_record' && entityId) {
    return href('/maintenance/:id', { id: entityId })
  }
  return null
}

function getEntityName(metadata: Record<string, unknown> | null) {
  if (!metadata) return null
  if (metadata.title && typeof metadata.title === 'string') return metadata.title
  if (metadata.name && typeof metadata.name === 'string') return metadata.name
  if (metadata.fileName && typeof metadata.fileName === 'string') return metadata.fileName
  return null
}

type LogEntry = {
  id: string
  action: string
  entityType: string
  entityId: string
  metadata: unknown
  createdAt: Date | string
  userName: string
}

function LogRow({ log }: { log: LogEntry }) {
  const meta = log.metadata as Record<string, unknown> | null
  const link = getEntityLink(log.entityType, log.entityId, meta)
  const entityName = getEntityName(meta)
  const isStatusChange =
    log.action === 'ticket.status_changed' &&
    typeof meta?.from === 'string' &&
    typeof meta?.to === 'string'

  const actionText = actionLabels[log.action] ?? log.action
  const nameNode = entityName ? (
    link ? (
      <Link to={link} className="text-primary hover:underline">
        {entityName}
      </Link>
    ) : (
      <span className="font-medium">{entityName}</span>
    )
  ) : link ? (
    <Link to={link} className="text-primary hover:underline">
      ver
    </Link>
  ) : null

  return (
    <div className="border-border relative border-b py-3 pl-6 last:border-b-0">
      <div className="bg-border absolute top-0 bottom-0 left-1.5 w-px" />
      <div className="bg-foreground/30 absolute top-4.5 left-0.5 size-2.5 rounded-full" />
      <p className="text-sm">
        <span className="font-medium">{log.userName}</span>{' '}
        <span className="text-muted-foreground">{actionText.toLowerCase()}</span>
        {nameNode && <> {nameNode}</>}
      </p>
      {isStatusChange && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Badge className={cn('text-xs', statusColors[meta.from as string])}>
            {statusLabels[meta.from as string] ?? (meta.from as string)}
          </Badge>
          <span className="text-muted-foreground text-xs">&rarr;</span>
          <Badge className={cn('text-xs', statusColors[meta.to as string])}>
            {statusLabels[meta.to as string] ?? (meta.to as string)}
          </Badge>
        </div>
      )}
      <p className="text-muted-foreground mt-1 text-xs">{formatDate(log.createdAt)}</p>
    </div>
  )
}

function FilterSelect({
  items,
  value,
  onChange,
  className,
}: {
  items: { label: string; value: string }[]
  value: string
  onChange: (value: string | null) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange} items={items}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-auto min-w-(--anchor-width)">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
