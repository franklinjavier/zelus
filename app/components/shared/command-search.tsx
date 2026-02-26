import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useFetcher } from 'react-router'
import {
  BookOpen01Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '~/components/ui/command'
import { mainNav, adminNav, extraNav } from '~/lib/navigation'
import type { SearchScope } from '~/lib/search/provider'

type LoaderData = {
  query: string
  results: {
    query: string
    results: Array<{
      id: string
      scope: SearchScope
      title: string
      description: string
      url: string
      createdAt: string
      rank: number
    }>
    total: number
  } | null
}

const scopeConfig: Record<SearchScope, { label: string; icon: IconSvgElement }> = {
  tickets: { label: 'Ocorrências', icon: Ticket02Icon },
  suppliers: { label: 'Prestadores', icon: TruckDeliveryIcon },
  maintenance: { label: 'Intervenções', icon: WrenchIcon },
  documents: { label: 'Documents', icon: BookOpen01Icon },
}

const SCOPES: SearchScope[] = ['tickets', 'suppliers', 'maintenance', 'documents']

export function CommandSearch({
  open,
  onOpenChange,
  isOrgAdmin,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isOrgAdmin: boolean
}) {
  const navigate = useNavigate()
  const fetcher = useFetcher<LoaderData>()
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  const handleValueChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const trimmed = value.trim()
      if (!trimmed) return
      debounceRef.current = setTimeout(() => {
        fetcher.load(`/search?q=${encodeURIComponent(trimmed)}`)
      }, 300)
    },
    [fetcher],
  )

  const handleSelect = useCallback(
    (url: string) => {
      onOpenChange(false)
      navigate(url)
    },
    [navigate, onOpenChange],
  )

  const results = fetcher.data?.results
  const isLoading = fetcher.state === 'loading'
  const hasQuery = query.trim().length > 0

  const allPages = useMemo(
    () => (isOrgAdmin ? [...mainNav, ...adminNav, ...extraNav] : [...mainNav, ...extraNav]),
    [isOrgAdmin],
  )

  const filteredPages = useMemo(() => {
    if (!hasQuery) return allPages
    const lower = query.trim().toLowerCase()
    return allPages.filter((p) => p.label.toLowerCase().includes(lower))
  }, [allPages, hasQuery, query])

  const grouped = results
    ? SCOPES.map((scope) => ({
        scope,
        items: results.results.filter((r) => r.scope === scope),
      })).filter((g) => g.items.length > 0)
    : []

  const noResults = hasQuery && !isLoading && filteredPages.length === 0 && grouped.length === 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pesquisa"
      description="Pesquise por ocorrências, prestadores, intervenções e conhecimento"
    >
      <Command shouldFilter={false}>
        <CommandInput placeholder="Pesquisar..." value={query} onValueChange={handleValueChange} />
        <CommandList>
          {noResults && <CommandEmpty>Nenhum resultado encontrado</CommandEmpty>}
          {hasQuery && isLoading && grouped.length === 0 && filteredPages.length === 0 && (
            <div className="text-muted-foreground py-6 text-center text-sm">A pesquisar...</div>
          )}
          {filteredPages.length > 0 && (
            <CommandGroup heading="Páginas">
              {filteredPages.map((page) => (
                <CommandItem key={page.to} value={page.to} onSelect={handleSelect}>
                  <HugeiconsIcon icon={page.icon} size={16} strokeWidth={2} />
                  {page.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.map(({ scope, items }) => {
            const config = scopeConfig[scope]
            return (
              <CommandGroup
                key={scope}
                heading={
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={config.icon} size={14} strokeWidth={2} />
                    {config.label}
                  </span>
                }
              >
                {items.map((item) => (
                  <CommandItem key={item.id} value={item.url} onSelect={handleSelect}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      {item.description && (
                        <p className="text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
