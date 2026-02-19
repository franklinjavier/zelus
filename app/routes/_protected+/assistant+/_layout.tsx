import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, href, useFetcher, useParams } from 'react-router'
import {
  Add01Icon,
  AiChat02Icon,
  Cancel01Icon,
  Delete02Icon,
  Menu01Icon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import { listConversations } from '~/lib/services/conversations'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  const expanded = hovered || menuOpen || !!editingId

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
        data-expanded={expanded || undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'bg-background group/sidebar absolute inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r',
          'transition-all duration-200 ease-in-out',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: collapsed by default, expand via data-expanded (hover + menu + editing)
          'md:w-14 md:translate-x-0 md:overflow-hidden md:data-expanded:w-72',
          'md:shadow-none md:data-expanded:shadow-xl',
        )}
      >
        {/* New conversation button */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button
            nativeButton={false}
            render={<Link to={href('/assistant')} onClick={() => setMobileOpen(false)} />}
            variant="outline"
            size="icon"
            className="shrink-0 max-md:hidden md:group-data-[expanded]/sidebar:hidden"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
          </Button>
          <Button
            nativeButton={false}
            render={<Link to={href('/assistant')} onClick={() => setMobileOpen(false)} />}
            variant="outline"
            className="flex flex-1 gap-2 md:hidden md:group-data-[expanded]/sidebar:flex"
          >
            <HugeiconsIcon icon={AiChat02Icon} size={16} />
            Nova conversa
          </Button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm md:hidden md:group-data-[expanded]/sidebar:block">
              Nenhuma conversa ainda
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-muted-foreground px-3 py-1 text-sm font-medium md:hidden md:group-data-[expanded]/sidebar:block">
                  {group.label}
                </p>
                {group.items.map((conv) =>
                  editingId === conv.id ? (
                    <SidebarRenameInput
                      key={conv.id}
                      conversation={conv}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <SidebarConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeId === conv.id}
                      onNavigate={() => setMobileOpen(false)}
                      onRename={() => setEditingId(conv.id)}
                      onMenuOpenChange={setMenuOpen}
                    />
                  ),
                )}
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* Spacer for collapsed sidebar on desktop */}
      <div className="hidden w-14 shrink-0 md:block" />

      {/* Chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
          <span className="flex-1 text-sm font-medium">Assistente</span>
          <Button
            nativeButton={false}
            render={<Link to={href('/assistant')} />}
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <HugeiconsIcon icon={AiChat02Icon} size={16} />
            Novo chat
          </Button>
        </div>

        <Outlet />
      </div>
    </div>
  )
}

function SidebarConversationItem({
  conversation,
  isActive,
  onNavigate,
  onRename,
  onMenuOpenChange,
}: {
  conversation: Conversation
  isActive: boolean
  onNavigate: () => void
  onRename: () => void
  onMenuOpenChange: (open: boolean) => void
}) {
  const fetcher = useFetcher()

  return (
    <div
      className={cn(
        'group/item relative flex items-center rounded-lg transition-colors',
        isActive
          ? 'bg-primary/10 text-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <NavLink
        to={href('/assistant/:id', { id: conversation.id })}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm"
      >
        <HugeiconsIcon icon={AiChat02Icon} size={14} className="shrink-0 opacity-50" />
        <span className="flex-1 truncate md:hidden md:group-data-[expanded]/sidebar:inline">
          {conversation.title || conversation.lastMessage || 'Nova conversa'}
        </span>
      </NavLink>

      <div className="pr-1 opacity-0 transition-opacity group-hover/item:opacity-100 max-md:opacity-100 md:hidden md:group-data-[expanded]/sidebar:block">
        <DropdownMenu onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger
            className="hover:bg-accent flex size-7 items-center justify-center rounded-md"
            onClick={(e) => e.stopPropagation()}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={4}>
            <DropdownMenuItem onClick={onRename}>
              <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                fetcher.submit(null, {
                  method: 'post',
                  action: href('/assistant/:id', { id: conversation.id }),
                })
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function SidebarRenameInput({
  conversation,
  onDone,
}: {
  conversation: Conversation
  onDone: () => void
}) {
  const fetcher = useFetcher()
  const [title, setTitle] = useState(
    conversation.title || conversation.lastMessage || 'Nova conversa',
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  function save() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== conversation.title) {
      fetcher.submit(
        { intent: 'rename', title: trimmed },
        { method: 'post', action: href('/assistant/:id', { id: conversation.id }) },
      )
    }
    onDone()
  }

  return (
    <div className="flex items-center gap-1 rounded-lg px-2 py-1">
      <HugeiconsIcon
        icon={AiChat02Icon}
        size={14}
        className="text-muted-foreground shrink-0 opacity-50"
      />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onDone()
        }}
        className="bg-muted min-w-0 flex-1 rounded px-1.5 py-0.5 text-sm outline-none"
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onDone()
        }}
        className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded transition-colors"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={13} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          save()
        }}
        className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded transition-colors"
      >
        <HugeiconsIcon icon={Tick02Icon} size={13} />
      </button>
    </div>
  )
}
