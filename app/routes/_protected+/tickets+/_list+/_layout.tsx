import { Add01Icon, LockIcon, Ticket02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href, Link, Outlet, useMatches, useNavigate } from 'react-router'

import { priorityLabels } from '~/components/tickets/priority-indicator'
import { statusLabels, type Status } from '~/components/tickets/status-badge'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { orgContext, userContext } from '~/lib/auth/context'
import { listCategories } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { listTickets } from '~/lib/services/tickets'
import type { Route } from './+types/_layout'
import { formatShortDate, getInitials } from '~/lib/format'
import { useFilterParams } from '~/lib/use-filter-params'
import { EmptyState } from '~/components/layout/empty-state'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Ocorrências — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)

  const url = new URL(request.url)
  const filters = {
    status: url.searchParams.get('status') || undefined,
    priority: url.searchParams.get('priority') || undefined,
    category: url.searchParams.get('category') || undefined,
    fractionId: url.searchParams.get('fractionId') || undefined,
  }

  const [tickets, categories] = await Promise.all([
    listTickets(orgId, userId, filters),
    listCategories(),
  ])

  return { tickets, categories }
}

const statusOrder: Status[] = ['open', 'in_progress', 'resolved', 'closed']

const statusDotColors: Record<Status, string> = {
  open: 'bg-primary',
  in_progress: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-muted-foreground',
}

export default function TicketsLayout({ loaderData }: Route.ComponentProps) {
  const { tickets, categories } = loaderData
  const { searchParams, setFilter } = useFilterParams()
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  const categoryLabelMap = new Map(categories.map((c) => [c.key, translateCategory(c.key)]))

  const grouped = statusOrder
    .map((status) => ({
      status,
      tickets: tickets.filter((t) => t.status === status),
    }))
    .filter((group) => group.tickets.length > 0)

  const statusItems = [
    { label: 'Todos os estados', value: '_all' },
    ...statusOrder.map((s) => ({ label: statusLabels[s], value: s })),
  ]

  const priorityItems = [
    { label: 'Todas as prioridades', value: '_all' },
    ...Object.entries(priorityLabels)
      .filter(([key]) => key !== '')
      .map(([value, label]) => ({ label, value })),
  ]

  const categoryItems = [
    { label: 'Todas as categorias', value: '_all' },
    ...categories.map((c) => ({ label: translateCategory(c.key), value: c.key })),
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Ocorrências</h1>
          <p className="text-muted-foreground text-sm">
            {tickets.length} {tickets.length === 1 ? 'ocorrência' : 'ocorrências'}
          </p>
        </div>
        <Button render={<Link to={href('/tickets/new')} />}>
          <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
          Nova ocorrência
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Select
          value={searchParams.get('status') ?? '_all'}
          onValueChange={(v) => setFilter('status', v)}
          items={statusItems}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('priority') ?? '_all'}
          onValueChange={(v) => setFilter('priority', v)}
          items={priorityItems}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select
            value={searchParams.get('category') ?? '_all'}
            onValueChange={(v) => setFilter('category', v)}
            items={categoryItems}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <EmptyState icon={Ticket02Icon} message="Nenhuma ocorrência encontrada" />
      ) : (
        <div className="mt-6 grid gap-5">
          {grouped.map(({ status, tickets: groupTickets }) => (
            <Card key={status}>
              <div className="flex items-center gap-2.5 px-6 pt-5 pb-1">
                <span className={`size-2.5 rounded-full ${statusDotColors[status]}`} />
                <span className="text-sm font-medium">{statusLabels[status]}</span>
                <Badge variant="secondary" className="ml-1">
                  {groupTickets.length}
                </Badge>
              </div>
              <CardContent className="p-0">
                <div className="divide-y">
                  {groupTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={href('/tickets/:id', { id: ticket.id })}
                      className="hover:bg-accent flex items-center gap-3 px-5 py-3.5 transition-colors"
                    >
                      {/* Left side */}
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="shrink-0">
                          <PriorityIndicatorIcon priority={ticket.priority} />
                        </span>
                        <span className="truncate font-medium">{ticket.title}</span>
                        {ticket.private && (
                          <HugeiconsIcon
                            icon={LockIcon}
                            size={14}
                            strokeWidth={2}
                            className="text-muted-foreground shrink-0"
                          />
                        )}
                      </div>

                      {/* Right side */}
                      <div className="flex shrink-0 items-center gap-3">
                        {ticket.category && categoryLabelMap.has(ticket.category) && (
                          <Badge variant="outline">{categoryLabelMap.get(ticket.category)}</Badge>
                        )}
                        {ticket.fractionLabel && (
                          <span className="text-muted-foreground text-sm">
                            {ticket.fractionLabel}
                          </span>
                        )}
                        <span className="text-muted-foreground text-sm">
                          {formatShortDate(ticket.createdAt)}
                        </span>
                        <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                          {getInitials(ticket.creatorName)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/tickets'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>Nova ocorrência</DrawerTitle>
            <DrawerDescription>Preencha os dados para criar uma nova ocorrência.</DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}

function PriorityIndicatorIcon({ priority }: { priority: string | null }) {
  const key = priority ?? ''
  const config: Record<string, { className: string }> = {
    urgent: { className: 'text-red-600' },
    high: { className: 'text-orange-500' },
    medium: { className: 'text-amber-500' },
    low: { className: 'text-emerald-600' },
    '': { className: 'text-muted-foreground' },
  }
  const { className } = config[key] ?? config['']

  return <span className={`inline-block size-2.5 rounded-full ${className} bg-current`} />
}
