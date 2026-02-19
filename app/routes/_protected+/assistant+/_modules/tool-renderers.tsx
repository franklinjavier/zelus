import { Link, href } from 'react-router'

import { priorityConfig, priorityLabels } from '~/components/tickets/priority-indicator'
import { StatusBadge, statusLabels, type Status } from '~/components/tickets/status-badge'
import { formatShortDate } from '~/lib/format'

type TicketRow = {
  id: string
  title: string
  status: string
  priority: string | null
  createdAt: string | Date
  fractionLabel?: string | null
  category?: string | null
}

function TicketListOutput({ tickets }: { tickets: TicketRow[] }) {
  if (!tickets.length) return null

  return (
    <div className="mt-2 divide-y rounded-lg border">
      {tickets.map((t) => {
        const pKey = t.priority ?? ''
        const { icon: PriorityIcon, className: prioClass } =
          priorityConfig[pKey] ?? priorityConfig['']
        return (
          <Link
            key={t.id}
            to={href('/tickets/:id', { id: t.id })}
            className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition-colors"
          >
            <PriorityIcon className={`size-4 shrink-0 ${prioClass}`} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
            <StatusBadge status={t.status as Status} />
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatShortDate(t.createdAt)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function TicketCreatedOutput({
  output,
}: {
  output: { success: boolean; ticketId: string; ticketUrl: string; title: string; status: string }
}) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5">
      <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
      <span className="flex-1 text-sm">
        Ocorrência criada:{' '}
        <Link
          to={href('/tickets/:id', { id: output.ticketId })}
          className="text-primary font-medium underline underline-offset-2"
        >
          {output.title}
        </Link>
      </span>
      <StatusBadge status={output.status as Status} />
    </div>
  )
}

function TicketSearchOutput({
  tickets,
}: {
  tickets: Array<{
    id: string
    title: string
    status: string
    priority: string | null
    category: string | null
    createdAt: string | Date
  }>
}) {
  if (!tickets.length) return null

  return (
    <div className="mt-2 divide-y rounded-lg border">
      {tickets.map((t) => {
        const pKey = t.priority ?? ''
        const { icon: PriorityIcon, className: prioClass } =
          priorityConfig[pKey] ?? priorityConfig['']
        return (
          <Link
            key={t.id}
            to={href('/tickets/:id', { id: t.id })}
            className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition-colors"
          >
            <PriorityIcon className={`size-4 shrink-0 ${prioClass}`} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
            <StatusBadge status={t.status as Status} />
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatShortDate(t.createdAt)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function TicketDetailOutput({
  ticket,
}: {
  ticket: {
    id: string
    title: string
    description: string
    status: string
    priority: string | null
    category: string | null
    createdAt: string | Date
    fractionLabel: string | null
  }
}) {
  const pKey = ticket.priority ?? ''
  const { icon: PriorityIcon, className: prioClass } = priorityConfig[pKey] ?? priorityConfig['']
  const prioLabel = priorityLabels[pKey] ?? 'Sem prioridade'

  return (
    <div className="mt-2 space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={href('/tickets/:id', { id: ticket.id })}
          className="text-primary text-sm font-semibold underline underline-offset-2"
        >
          {ticket.title}
        </Link>
        <StatusBadge status={ticket.status as Status} />
      </div>
      <p className="text-muted-foreground line-clamp-3 text-sm">{ticket.description}</p>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={`inline-flex items-center gap-1 ${prioClass}`}>
          <PriorityIcon className="size-3.5" />
          {prioLabel}
        </span>
        {ticket.category && <span>{ticket.category}</span>}
        {ticket.fractionLabel && <span>{ticket.fractionLabel}</span>}
        <span>{formatShortDate(ticket.createdAt)}</span>
      </div>
    </div>
  )
}

function StatusUpdateOutput({
  output,
}: {
  output: { success: boolean; ticketUrl: string; title: string; newStatus: string }
}) {
  const label = statusLabels[output.newStatus as Status] ?? output.newStatus

  return (
    <div className="bg-primary/5 mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5">
      <span className="text-sm">
        Estado atualizado para <StatusBadge status={output.newStatus as Status} /> em{' '}
        <Link
          to={output.ticketUrl}
          className="text-primary font-medium underline underline-offset-2"
        >
          {output.title}
        </Link>
      </span>
    </div>
  )
}

/**
 * Returns a custom React element for known tool outputs, or null for tools
 * that should be invisible (their text response covers the explanation).
 */
export function renderToolOutput(toolName: string, output: unknown): React.ReactNode | null {
  if (!output || typeof output !== 'object') return null

  switch (toolName) {
    case 'list_my_tickets': {
      const tickets = output as TicketRow[]
      if (!Array.isArray(tickets) || tickets.length === 0) return null
      return <TicketListOutput tickets={tickets} />
    }

    case 'create_ticket': {
      const data = output as {
        success: boolean
        ticketId: string
        ticketUrl: string
        title: string
        status: string
      }
      if (!data.success) return null
      return <TicketCreatedOutput output={data} />
    }

    case 'search_org_tickets': {
      const tickets = output as Array<{
        id: string
        title: string
        status: string
        priority: string | null
        category: string | null
        createdAt: string | Date
      }>
      if (!Array.isArray(tickets) || tickets.length === 0) return null
      return <TicketSearchOutput tickets={tickets} />
    }

    case 'get_ticket_details': {
      const data = output as Record<string, unknown>
      if ('error' in data) return null
      return (
        <TicketDetailOutput
          ticket={
            data as {
              id: string
              title: string
              description: string
              status: string
              priority: string | null
              category: string | null
              createdAt: string | Date
              fractionLabel: string | null
            }
          }
        />
      )
    }

    case 'update_ticket_status': {
      const data = output as Record<string, unknown>
      if ('error' in data) return null
      return (
        <StatusUpdateOutput
          output={
            data as {
              success: boolean
              ticketUrl: string
              title: string
              newStatus: string
            }
          }
        />
      )
    }

    // Hidden tools — text response covers these
    case 'add_ticket_comment':
    case 'get_building_info':
    case 'get_my_fractions':
    case 'search_documents':
      return null

    default:
      return null
  }
}
