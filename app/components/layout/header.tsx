import { Notification03Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href } from 'react-router'

import { Button } from '~/components/ui/button'
import { SidebarTrigger } from '~/components/ui/sidebar'

export function Header({ unreadCount }: { unreadCount?: number }) {
  return (
    <header className="bg-background relative flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1 size-10" />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link to={href('/search')} />}
          title="Pesquisar"
        >
          <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={2} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
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
