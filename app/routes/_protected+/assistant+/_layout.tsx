import { useState } from 'react'
import { Link, NavLink, Outlet, href, useParams } from 'react-router'
import { Add01Icon, AiChat02Icon, Menu01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import { listConversations } from '~/lib/services/conversations'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export async function loader({ context }: Route.LoaderArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  const conversations = await listConversations(org.orgId, user.id)

  return { conversations }
}

type Conversation = Awaited<ReturnType<typeof listConversations>>[number]

function groupByDate(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Hoje', items: [] },
    { label: 'Ontem', items: [] },
    { label: 'Últimos 7 dias', items: [] },
    { label: 'Mais antigos', items: [] },
  ]

  for (const conv of conversations) {
    const date = conv.updatedAt ?? conv.createdAt
    if (!date) {
      groups[3].items.push(conv)
      continue
    }
    const d = new Date(date)
    if (d >= today) groups[0].items.push(conv)
    else if (d >= yesterday) groups[1].items.push(conv)
    else if (d >= weekAgo) groups[2].items.push(conv)
    else groups[3].items.push(conv)
  }

  return groups.filter((g) => g.items.length > 0)
}

export default function AssistantLayout({ loaderData }: Route.ComponentProps) {
  const { conversations } = loaderData
  const params = useParams()
  const activeId = params.id
  const [mobileOpen, setMobileOpen] = useState(false)

  const groups = groupByDate(conversations)

  return (
    <div className="relative -mx-4 -my-6 flex h-[calc(100%+3rem)] overflow-hidden lg:-mx-8">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="bg-background/80 absolute inset-0 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      {/* Hover sidebar — overlays within assistant area */}
      <aside
        className={cn(
          'bg-background group/sidebar absolute inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r',
          'transition-all duration-200 ease-in-out',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: collapsed by default, expand on hover
          'md:w-14 md:translate-x-0 md:overflow-hidden md:hover:w-72',
          'md:shadow-none md:hover:shadow-xl',
        )}
      >
        {/* New conversation button */}
        <div className="flex items-center gap-2 border-b p-3">
          <Button
            nativeButton={false}
            render={<Link to={href('/assistant')} onClick={() => setMobileOpen(false)} />}
            variant="outline"
            size="icon"
            className="shrink-0 md:group-hover/sidebar:hidden"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
          </Button>
          <Button
            nativeButton={false}
            render={<Link to={href('/assistant')} onClick={() => setMobileOpen(false)} />}
            variant="outline"
            className="hidden flex-1 gap-2 md:group-hover/sidebar:flex"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            Nova conversa
          </Button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="text-muted-foreground hidden px-3 py-6 text-center text-sm md:group-hover/sidebar:block">
              Nenhuma conversa ainda
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-muted-foreground hidden px-3 py-1 text-sm font-medium md:group-hover/sidebar:block">
                  {group.label}
                </p>
                {group.items.map((conv) => (
                  <NavLink
                    key={conv.id}
                    to={href('/assistant/:id', { id: conv.id })}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      activeId === conv.id
                        ? 'bg-primary/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <HugeiconsIcon icon={AiChat02Icon} size={14} className="shrink-0 opacity-50" />
                    <span className="hidden flex-1 truncate md:group-hover/sidebar:inline">
                      {conv.title || conv.lastMessage || 'Nova conversa'}
                    </span>
                  </NavLink>
                ))}
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* Spacer for collapsed sidebar on desktop */}
      <div className="hidden w-14 shrink-0 md:block" />

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header with sidebar toggle */}
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir conversas"
          >
            <HugeiconsIcon icon={Menu01Icon} size={18} />
          </Button>
          <span className="text-sm font-medium">Assistente</span>
        </div>

        <Outlet />
      </div>
    </div>
  )
}
