import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, File01Icon } from '@hugeicons/core-free-icons'

import { statusLabels } from '~/components/tickets/status-badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { formatRelativeTime, getInitials } from '~/lib/format'

type CommentItem = {
  type: 'comment'
  id: string
  userName: string
  userImage?: string | null
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
  userImage?: string | null
  fromStatus: string
  toStatus: string
  createdAt: string
}

type AttachmentItem = {
  type: 'attachment'
  id: string
  userName: string
  userImage?: string | null
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  createdAt: string
}

type TimelineItem = CommentItem | StatusChangeItem | AttachmentItem

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MemberAvatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <Avatar className="size-8">
      {image && <AvatarImage src={image} alt={name} />}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

function ImagePreview({
  src,
  alt,
  className,
  caption,
}: {
  src: string
  alt: string
  className?: string
  caption?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  const open = useCallback(() => {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const close = useCallback(() => setVisible(false), [])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, close])

  return (
    <>
      <button type="button" onClick={open} className={className ?? 'mt-1.5 block cursor-zoom-in'}>
        <img
          src={src}
          alt={alt}
          className={
            className
              ? 'size-full rounded-md border object-cover'
              : 'max-h-64 rounded-lg border object-contain'
          }
        />
      </button>
      {mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ease-out"
            style={{
              backgroundColor: visible ? 'rgb(0 0 0 / 0.9)' : 'rgb(0 0 0 / 0)',
            }}
            onClick={close}
            onTransitionEnd={() => {
              if (!visible) setMounted(false)
            }}
          >
            <button
              type="button"
              onClick={close}
              className="absolute top-4 right-4 transition-all duration-200"
              style={{ opacity: visible ? 0.7 : 0 }}
              onMouseEnter={(e) => {
                if (visible) e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                if (visible) e.currentTarget.style.opacity = '0.7'
              }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={24} strokeWidth={2} className="text-white" />
            </button>
            <div
              className="flex flex-col items-center gap-3 transition-all duration-200 ease-out"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'scale(1)' : 'scale(0.95)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={src} alt={alt} className="max-h-[85vh] max-w-[90vw] object-contain" />
              {caption && <p className="text-sm text-white/70">{caption}</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function CommentEntry({ item }: { item: CommentItem }) {
  return (
    <div className="my-2 flex gap-3">
      <MemberAvatar name={item.userName} image={item.userImage} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{item.userName}</span>
          <span className="text-muted-foreground"> · {formatRelativeTime(item.createdAt)}</span>
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{item.content}</p>
        {item.attachments && item.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {item.attachments.map((att) => (
              <div key={att.id}>
                <a
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
                {att.mimeType.startsWith('image/') && (
                  <ImagePreview src={att.fileUrl} alt={att.fileName} />
                )}
              </div>
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
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center">
        <span className="bg-muted-foreground/40 size-2 rounded-full" />
      </span>
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
  const isImage = item.mimeType.startsWith('image/')
  return (
    <div className="my-2 flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center">
        <HugeiconsIcon
          icon={File01Icon}
          size={14}
          strokeWidth={1.5}
          className="text-muted-foreground"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-sm">
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
        {isImage && <ImagePreview src={item.fileUrl} alt={item.fileName} />}
      </div>
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

export { TimelineEntry, ImagePreview, formatFileSize }
export type { TimelineItem, CommentItem, StatusChangeItem, AttachmentItem }
