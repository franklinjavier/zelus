import { href, Link } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, WrenchIcon } from '@hugeicons/core-free-icons'
import { formatCost, formatDate } from '~/lib/format'
import { useFilterParams } from '~/lib/use-filter-params'
import { EmptyState } from '~/components/layout/empty-state'

import type { Route } from './+types/index'
import { orgContext } from '~/lib/auth/context'
import { listRecords } from '~/lib/services/maintenance'
import { listSuppliers } from '~/lib/services/suppliers'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Manutenções — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)

  const url = new URL(request.url)
  const supplierId = url.searchParams.get('supplierId') || undefined

  const [records, suppliers] = await Promise.all([
    listRecords(orgId, { supplierId }),
    listSuppliers(orgId),
  ])

  return { records, suppliers, effectiveRole }
}

export default function MaintenancePage({ loaderData }: Route.ComponentProps) {
  const { records, suppliers, effectiveRole } = loaderData
  const isAdmin = effectiveRole === 'org_admin'
  const { searchParams, setFilter } = useFilterParams()

  const supplierItems = [
    { label: 'Todos os fornecedores', value: '_all' },
    ...suppliers.map((s) => ({ label: s.name, value: s.id })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Manutenções</h1>
          <p className="text-muted-foreground text-sm">
            {records.length} {records.length === 1 ? 'registo' : 'registos'}
          </p>
        </div>
        {isAdmin && (
          <Button render={<Link to={href('/maintenance/new')} />}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            Novo registo
          </Button>
        )}
      </div>

      {suppliers.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Select
            value={searchParams.get('supplierId') ?? '_all'}
            onValueChange={(v) => setFilter('supplierId', v)}
            items={supplierItems}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supplierItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState icon={WrenchIcon} message="Nenhum registo de manutenção encontrado">
          {isAdmin && (
            <Button render={<Link to={href('/maintenance/new')} />} variant="outline">
              Criar primeiro registo
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="divide-y">
              {records.map((record) => (
                <Link
                  key={record.id}
                  to={href('/maintenance/:id', { id: record.id })}
                  className="hover:bg-accent flex items-center gap-3 px-5 py-3.5 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="truncate font-medium">{record.title}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {record.supplierName && <Badge variant="outline">{record.supplierName}</Badge>}
                    <span className="text-muted-foreground text-sm">
                      {formatDate(record.performedAt)}
                    </span>
                    {formatCost(record.cost) && (
                      <span className="text-sm font-medium tabular-nums">
                        {formatCost(record.cost)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
