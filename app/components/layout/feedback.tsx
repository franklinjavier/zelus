import { Alert02Icon, AlertIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

export function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl px-4 py-3 text-sm',
        className,
      )}
    >
      <HugeiconsIcon icon={AlertIcon} size={14} strokeWidth={2} className="shrink-0" />
      {children}
    </div>
  )
}

export function WarningBanner({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-700',
        className,
      )}
    >
      <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={2} className="shrink-0" />
      {children}
    </div>
  )
}
