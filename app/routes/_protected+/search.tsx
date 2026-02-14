import {
  Search01Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Form, Link, useNavigation } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { orgContext, userContext } from '~/lib/auth/context'
import { formatShortDate } from '~/lib/format'
import { search, type SearchScope } from '~/lib/search'
import { EmptyState } from '~/components/layout/empty-state'
import type { Route } from './+types/search'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Pesquisa — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return { query: '', results: null }
  }

  const scopes: SearchScope[] = ['tickets', 'suppliers', 'maintenance']
  const searchResults = await search.search(orgId, q, scopes, userId)

  return { query: q, results: searchResults }
}

const scopeConfig = {
  tickets: { label: 'Ocorrências', icon: Ticket02Icon },
  suppliers: { label: 'Fornecedores', icon: TruckDeliveryIcon },
  maintenance: { label: 'Manutenções', icon: WrenchIcon },
} satisfies Partial<{ [K in SearchScope]: { label: string; icon: IconSvgElement } }>

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { query, results } = loaderData
  const navigation = useNavigation()
  const isSearching = navigation.state === 'loading' && navigation.location?.pathname === '/search'

  const grouped = results
    ? (['tickets', 'suppliers', 'maintenance'] as SearchScope[])
        .map((scope) => ({
          scope,
          items: results.results.filter((r) => r.scope === scope),
        }))
        .filter((g) => g.items.length > 0)
    : []

  return (
    <div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pesquisa</h1>
        <p className="text-muted-foreground text-sm">
          Pesquise por ocorrências, fornecedores e manutenções
        </p>
      </div>

      <Form method="get" className="mt-6">
        <div className="relative max-w-lg">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={2}
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="O que procura?"
            className="pl-9"
            autoFocus
          />
        </div>
      </Form>

      <div className="mt-6">
        {isSearching ? (
          <p className="text-muted-foreground text-sm">A pesquisar...</p>
        ) : results === null ? (
          <EmptyState icon={Search01Icon} message="Introduza um termo para pesquisar" />
        ) : results.total === 0 ? (
          <EmptyState icon={Search01Icon} message="Nenhum resultado encontrado" />
        ) : (
          <div className="grid gap-5">
            <p className="text-muted-foreground text-sm">
              {results.total} {results.total === 1 ? 'resultado' : 'resultados'} para &ldquo;
              {results.query}&rdquo;
            </p>

            {grouped.map(({ scope, items }) => {
              const config = scopeConfig[scope]
              return (
                <Card key={scope}>
                  <div className="flex items-center gap-2.5 px-6 pt-5 pb-1">
                    <HugeiconsIcon
                      icon={config.icon}
                      size={16}
                      strokeWidth={2}
                      className="text-muted-foreground"
                    />
                    <span className="text-sm font-medium">{config.label}</span>
                    <Badge variant="secondary" className="ml-1">
                      {items.length}
                    </Badge>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {items.map((item) => (
                        <Link
                          key={item.id}
                          to={item.url}
                          className="hover:bg-accent flex items-center justify-between gap-3 px-5 py-3.5 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-muted-foreground mt-0.5 truncate text-sm">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="text-muted-foreground shrink-0 text-sm">
                            {formatShortDate(item.createdAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
