import { href, Link, Outlet, useMatches, useNavigate } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Call02Icon,
  TruckDeliveryIcon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/_layout'
import { orgContext } from '~/lib/auth/context'
import { listSuppliers } from '~/lib/services/suppliers'
import { listCategories } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { CardLink } from '~/components/brand/card-link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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
  return [{ title: 'Fornecedores — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)

  const url = new URL(request.url)
  const category = url.searchParams.get('category') || undefined

  const [suppliersList, categories] = await Promise.all([
    listSuppliers(orgId, { category }),
    listCategories(),
  ])

  return { suppliers: suppliersList, categories, effectiveRole }
}

export default function SuppliersLayout({ loaderData }: Route.ComponentProps) {
  const { suppliers, categories, effectiveRole } = loaderData
  const isAdmin = effectiveRole === 'org_admin'
  const { searchParams, setFilter } = useFilterParams()
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  const categoryItems = [
    { label: 'Todas as categorias', value: '_all' },
    ...categories.map((c) => ({ label: translateCategory(c.key), value: c.key })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground text-sm">
            {suppliers.length} {suppliers.length === 1 ? 'fornecedor' : 'fornecedores'}
          </p>
        </div>
        {isAdmin && (
          <Button render={<Link to={href('/suppliers/new')} />}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            Novo fornecedor
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
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
        </div>
      )}

      {suppliers.length === 0 ? (
        <EmptyState icon={TruckDeliveryIcon} message="Nenhum fornecedor encontrado">
          {isAdmin && (
            <Button render={<Link to={href('/suppliers/new')} />} variant="outline">
              Criar primeiro fornecedor
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <CardLink key={supplier.id} to={href('/suppliers/:id', { id: supplier.id })}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{supplier.name}</p>
                <Badge variant="secondary">{translateCategory(supplier.category)}</Badge>
              </div>
              <div className="text-muted-foreground mt-1.5 flex flex-col gap-1 text-sm">
                {supplier.contactName && (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <HugeiconsIcon
                      icon={UserCircleIcon}
                      size={14}
                      strokeWidth={2}
                      className="shrink-0"
                    />
                    {supplier.contactName}
                  </span>
                )}
                {(supplier.contactPhone || supplier.phone) && (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <HugeiconsIcon
                      icon={Call02Icon}
                      size={14}
                      strokeWidth={2}
                      className="shrink-0"
                    />
                    {supplier.contactPhone || supplier.phone}
                  </span>
                )}
              </div>
            </CardLink>
          ))}
        </div>
      )}

      {isAdmin && (
        <Drawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            if (!open) navigate(href('/suppliers'))
          }}
        >
          <DrawerPopup>
            <DrawerHeader>
              <DrawerTitle>Novo fornecedor</DrawerTitle>
              <DrawerDescription>
                Preencha os dados para registar um novo fornecedor.
              </DrawerDescription>
            </DrawerHeader>
            <Outlet />
          </DrawerPopup>
        </Drawer>
      )}
    </div>
  )
}
