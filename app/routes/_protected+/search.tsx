import {
  BookOpen01Icon,
  Search01Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Form, Link, useNavigation } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { orgContext, userContext } from '~/lib/auth/context'
import { formatShortDate } from '~/lib/format'
import { search, type SearchScope } from '~/lib/search/index.server'
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

  const scopes: SearchScope[] = ['tickets', 'suppliers', 'maintenance', 'documents']
  const searchResults = await search.search(orgId, q, scopes, userId)

  console.log('Search results:', searchResults)
  return { query: q, results: searchResults }
}

const scopeConfig = {
  tickets: { label: 'Ocorrências', icon: Ticket02Icon },
  suppliers: { label: 'Prestadores', icon: TruckDeliveryIcon },
  maintenance: { label: 'Intervenções', icon: WrenchIcon },
  documents: { label: 'Documentos', icon: BookOpen01Icon },
} satisfies { [K in SearchScope]: { label: string; icon: IconSvgElement } }

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { query, results } = loaderData
  const navigation = useNavigation()
  const isSearching = navigation.state === 'loading' && navigation.location?.pathname === '/search'

  const grouped = results
    ? (['tickets', 'suppliers', 'maintenance', 'documents'] as SearchScope[])
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
          Pesquise por ocorrências, prestadores, intervenções e documentos
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
                <div key={scope}>
                  <div className="flex items-center gap-2.5">
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
                  <div className="mt-3 flex flex-col gap-2">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.url}
                        className="ring-foreground/5 hover:bg-accent flex items-center justify-between gap-3 rounded-2xl p-3 ring-1 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
