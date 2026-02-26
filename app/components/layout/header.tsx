import {
  Home09Icon,
  Notification03Icon,
  Search01Icon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href, useLocation } from 'react-router'

import { Button } from '~/components/ui/button'
import { SidebarTrigger } from '~/components/ui/sidebar'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverPopup,
} from '~/components/ui/popover'
import { InviteLinkCard } from '~/components/shared/invite-link-card'

export function Header({
  unreadCount,
  inviteUrl,
  onSearchOpen,
}: {
  unreadCount?: number
  inviteUrl?: string | null
  onSearchOpen: () => void
}) {
  const location = useLocation()
  const isHomeRoute = location.pathname === href('/home')

  return (
    <header className="bg-background relative flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1 size-10" />
      {!isHomeRoute && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={href('/home')} />}
          className="md:hidden"
        >
          <HugeiconsIcon icon={Home09Icon} size={16} strokeWidth={2} data-icon="inline-start" />
          <span>Home</span>
        </Button>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onSearchOpen}
          aria-label="Pesquisar"
          className="text-muted-foreground hover:bg-muted hover:text-foreground md:hover:bg-accent flex h-10 w-10 items-center justify-center gap-2 rounded-2xl px-0 text-sm transition-colors md:w-auto md:justify-start md:border md:px-3"
        >
          <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} />
          <span className="hidden md:inline">Pesquisar...</span>
          <kbd className="bg-muted text-muted-foreground pointer-events-none -mr-1 hidden rounded-md border px-1.5 text-[11px] font-medium md:flex md:items-center md:gap-0.5">
            <span className="text-base">⌘</span>
            <span>K</span>
          </kbd>
        </button>

        <PopoverRoot>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="lg"
                aria-label="Convidar"
                className="text-primary hover:bg-primary/10 hover:text-primary md:bg-primary/10 md:hover:bg-primary/20 size-10 px-0 md:h-10 md:w-auto md:px-4"
              >
                <HugeiconsIcon icon={UserAdd01Icon} size={16} strokeWidth={2} />
                <span className="hidden md:inline">Convidar</span>
              </Button>
            }
          />
          <PopoverPortal>
            <PopoverPositioner side="bottom" align="end" sideOffset={8}>
              <PopoverPopup className="w-96">
                {inviteUrl ? (
                  <InviteLinkCard url={inviteUrl} card={false} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    O link de convite não está ativo. Fale com a administração para o ativar.
                  </p>
                )}
              </PopoverPopup>
            </PopoverPositioner>
          </PopoverPortal>
        </PopoverRoot>

        <Button
          variant="ghost"
          size="icon-lg"
          nativeButton={false}
          render={<Link to={href('/notifications')} />}
          title="Notificações"
          className="relative"
        >
          <HugeiconsIcon icon={Notification03Icon} size={18} strokeWidth={2} />
          {unreadCount != null && unreadCount > 0 && (
            <span className="bg-primary absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
