import type { ReactNode } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { cn } from '~/lib/utils'

export function EmptyState({
  icon,
  message,
  children,
  className,
}: {
  icon: IconSvgElement
  message: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mt-16 flex flex-col items-center gap-4', className)}>
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <HugeiconsIcon icon={icon} size={24} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
      {children}
    </div>
  )
}
