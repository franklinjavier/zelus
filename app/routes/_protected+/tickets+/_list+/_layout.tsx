import { Add01Icon, LockIcon, Ticket02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href, Link, Outlet, useMatches, useNavigate } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { CategorySelect } from '~/components/shared/category-select'
import { priorityConfig, priorityLabels } from '~/components/tickets/priority-indicator'
import { statusLabels, type Status } from '~/components/tickets/status-badge'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
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
import { formatShortDate } from '~/lib/format'
import { listCategories } from '~/lib/services/categories'
import { listTickets } from '~/lib/services/tickets'
import { useFilterParams } from '~/lib/use-filter-params'
import { cn } from '~/lib/utils'
import type { Route } from './+types/_layout'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Ocorrências — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)

  const url = new URL(request.url)
  const scope = (url.searchParams.get('scope') || 'all') as 'mine' | 'all' | 'private'
  const filters = {
    status: url.searchParams.get('status') || undefined,
    priority: url.searchParams.get('priority') || undefined,
    category: url.searchParams.get('category') || undefined,
    fractionId: url.searchParams.get('fractionId') || undefined,
    scope,
  }

  const [tickets, categories] = await Promise.all([
    listTickets(orgId, userId, filters),
    listCategories(),
  ])

  return { tickets, categories }
}

const statusOrder: Status[] = ['open', 'in_progress', 'resolved', 'closed']

const statusBadgeColors: Record<Status, string> = {
  open: 'bg-primary/15 text-primary',
  in_progress: 'bg-amber-500/15 text-amber-600',
  resolved: 'bg-emerald-500/15 text-emerald-600',
  closed: 'bg-muted-foreground/15 text-muted-foreground',
}

const statusGradients: Record<Status, string> = {
  open: 'from-primary/5',
  in_progress: 'from-amber-500/5',
  resolved: 'from-emerald-500/5',
  closed: 'from-muted-foreground/5',
}

export default function TicketsLayout({ loaderData }: Route.ComponentProps) {
  const { tickets, categories } = loaderData
  const { searchParams, setFilter } = useFilterParams()
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

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
        <Button nativeButton={false} render={<Link to={href('/tickets/new')} />}>
          <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
          Nova ocorrência
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="border-border flex overflow-hidden rounded-full border">
          <button
            type="button"
            onClick={() => setFilter('scope', '_all')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              !searchParams.get('scope') || searchParams.get('scope') === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilter('scope', 'mine')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              searchParams.get('scope') === 'mine'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            Minhas
          </button>
          <button
            type="button"
            onClick={() => setFilter('scope', 'private')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              searchParams.get('scope') === 'private'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            Privadas
          </button>
        </div>

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
            {priorityItems.map((item) => {
              const config = priorityConfig[item.value]
              return (
                <SelectItem key={item.value} value={item.value} className={config?.className}>
                  {config && <config.icon className="size-4" />}
                  {item.label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <CategorySelect
            categories={categories}
            defaultValue={searchParams.get('category')}
            name="category"
            className="w-56"
            placeholder="Todas as categorias"
            onValueChange={(v) => setFilter('category', v ?? '_all')}
          />
        )}
      </div>

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <EmptyState icon={Ticket02Icon} message="Nenhuma ocorrência encontrada" />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {statusOrder.map((status) => {
            const groupTickets = tickets.filter((t) => t.status === status)
            const activeStatusFilter = searchParams.get('status')
            const isFiltered = activeStatusFilter && activeStatusFilter !== '_all'

            // Hide empty groups when a status filter is active
            if (isFiltered && groupTickets.length === 0) return null

            // Don't cap when viewing a single status
            const maxVisible = isFiltered ? groupTickets.length : 5
            const visibleTickets = groupTickets.slice(0, maxVisible)
            const overflow = groupTickets.length - maxVisible

            return (
              <Card
                key={status}
                className={cn(
                  'gap-0 bg-gradient-to-b to-transparent py-0',
                  statusGradients[status],
                  groupTickets.length === 0 && 'opacity-40',
                )}
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="text-sm font-medium">{statusLabels[status]}</span>
                  <Badge className={statusBadgeColors[status]}>{groupTickets.length}</Badge>
                </div>
                <div className="flex flex-col gap-1.5 px-3 pb-3">
                  {groupTickets.length === 0 ? (
                    <p className="text-muted-foreground px-1 text-sm">Nenhuma ocorrência</p>
                  ) : (
                    <>
                      {visibleTickets.map((ticket) => (
                        <Link
                          key={ticket.id}
                          to={href('/tickets/:id', { id: ticket.id })}
                          className="hover:bg-accent/50 flex items-center gap-3 rounded-xl p-2.5 transition-colors"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <span className="shrink-0">
                              <PriorityIndicatorIcon priority={ticket.priority} />
                            </span>
                            <span className="truncate text-sm font-medium">{ticket.title}</span>
                            {ticket.private && (
                              <Badge variant="outline" className="shrink-0 gap-1">
                                <HugeiconsIcon icon={LockIcon} size={12} strokeWidth={2} />
                                Privado
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground shrink-0 text-sm">
                            {formatShortDate(ticket.createdAt)}
                          </span>
                        </Link>
                      ))}
                      {overflow > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilter('status', status)}
                          className="text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-left text-sm transition-colors"
                        >
                          e mais {overflow}...
                        </button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )
          })}
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
  const { icon: Icon, className } = priorityConfig[key] ?? priorityConfig['']
  return <Icon className={`size-4 ${className}`} />
}
