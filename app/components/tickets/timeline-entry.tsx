import { HugeiconsIcon } from '@hugeicons/react'
import { File01Icon } from '@hugeicons/core-free-icons'

import { statusLabels } from '~/components/tickets/status-badge'

type CommentItem = {
  type: 'comment'
  id: string
  userName: string
  content: string
  createdAt: string
  attachments?: {
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
  }[]
}

type StatusChangeItem = {
  type: 'status_change'
  id: string
  userName: string
  fromStatus: string
  toStatus: string
  createdAt: string
}

type AttachmentItem = {
  type: 'attachment'
  id: string
  userName: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  createdAt: string
}

type TimelineItem = CommentItem | StatusChangeItem | AttachmentItem

function formatRelativeTime(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'agora'
  if (minutes === 1) return 'há 1 minuto'
  if (minutes < 60) return `há ${minutes} minutos`
  if (hours === 1) return 'há 1 hora'
  if (hours < 24) return `há ${hours} horas`
  if (days === 1) return 'há 1 dia'
  if (days < 7) return `há ${days} dias`
  if (weeks === 1) return 'há 1 semana'
  if (weeks < 4) return `há ${weeks} semanas`
  if (months === 1) return 'há 1 mês'
  return `há ${months} meses`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
      {initials}
    </div>
  )
}

function CommentEntry({ item }: { item: CommentItem }) {
  return (
    <div className="flex gap-3">
      <MemberAvatar name={item.userName} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{item.userName}</span>
          <span className="text-muted-foreground"> · {formatRelativeTime(item.createdAt)}</span>
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{item.content}</p>
        {item.attachments && item.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {item.attachments.map((att) => (
              <a
                key={att.id}
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
              >
                <HugeiconsIcon icon={File01Icon} size={14} strokeWidth={2} className="shrink-0" />
                {att.fileName}
                <span className="text-muted-foreground text-sm">
                  ({formatFileSize(att.fileSize)})
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusChangeEntry({ item }: { item: StatusChangeItem }) {
  const toLabel = statusLabels[item.toStatus as keyof typeof statusLabels] ?? item.toStatus
  return (
    <div className="flex items-center gap-3 pl-2.5">
      <span className="bg-muted-foreground/40 size-2 shrink-0 rounded-full" />
      <p className="text-muted-foreground text-sm">
        {item.userName} alterou o estado para{' '}
        <span className="text-foreground font-medium">{toLabel}</span>
        {' · '}
        {formatRelativeTime(item.createdAt)}
      </p>
    </div>
  )
}

function AttachmentEntry({ item }: { item: AttachmentItem }) {
  return (
    <div className="flex items-center gap-3 pl-2">
      <HugeiconsIcon
        icon={File01Icon}
        size={14}
        strokeWidth={1.5}
        className="text-muted-foreground shrink-0"
      />
      <p className="text-muted-foreground min-w-0 text-sm">
        {item.userName} anexou{' '}
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
        >
          {item.fileName}
        </a>
        <span className="text-muted-foreground"> ({formatFileSize(item.fileSize)})</span>
        {' · '}
        {formatRelativeTime(item.createdAt)}
      </p>
    </div>
  )
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  switch (item.type) {
    case 'comment':
      return <CommentEntry item={item} />
    case 'status_change':
      return <StatusChangeEntry item={item} />
    case 'attachment':
      return <AttachmentEntry item={item} />
  }
}

export { TimelineEntry, formatRelativeTime, formatFileSize }
export type { TimelineItem, CommentItem, StatusChangeItem, AttachmentItem }
