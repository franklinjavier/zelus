import type { ReactNode } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

export function EmptyState({
  icon,
  message,
  children,
}: {
  icon: IconSvgElement
  message: string
  children?: ReactNode
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-4">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <HugeiconsIcon icon={icon} size={24} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
      {children}
    </div>
  )
}
