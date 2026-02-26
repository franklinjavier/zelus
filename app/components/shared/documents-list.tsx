import { File02Icon, Link04Icon, TextIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href } from 'react-router'

import { formatFileSize, formatShortDate } from '~/lib/format'
import { getDocumentPreview, getDocumentTitle } from '~/lib/services/documents-display'
import { cn } from '~/lib/utils'

type DocumentType = 'file' | 'article' | 'url'

export type DocumentsListItem = {
  id: string
  type: DocumentType
  title: string | null
  fileName: string | null
  body?: string | null
  sourceUrl?: string | null
  fileSize?: number | null
  createdAt?: Date | string
}

type DocumentsListProps = {
  docs: DocumentsListItem[]
}

const typeBadge = {
  file: { label: 'Ficheiro', className: 'bg-blue-50 text-blue-700' },
  article: { label: 'Texto', className: 'bg-green-50 text-green-700' },
  url: { label: 'Fonte externa', className: 'bg-purple-50 text-purple-700' },
} as const

const typeIcon = {
  file: File02Icon,
  article: TextIcon,
  url: Link04Icon,
} as const

export function DocumentsList({ docs }: DocumentsListProps) {
  return (
    <div className="@container flex flex-col gap-2">
      {docs.map((doc) => {
        const icon = typeIcon[doc.type]
        const preview = getDocumentPreview({
          type: doc.type,
          body: doc.body ?? null,
          sourceUrl: doc.sourceUrl ?? null,
        })

        return (
          <Link
            key={doc.id}
            to={href('/documents/:id', { id: doc.id })}
            className="ring-foreground/5 hover:bg-muted/30 flex flex-col gap-3 rounded-2xl p-3 ring-1 transition-colors @md:flex-row @md:items-center"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 @md:items-center">
              <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                <HugeiconsIcon icon={icon} size={18} className="text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{getDocumentTitle(doc)}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-xs font-medium',
                      typeBadge[doc.type].className,
                    )}
                  >
                    {typeBadge[doc.type].label}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {doc.type === 'file' && doc.fileSize ? `${formatFileSize(doc.fileSize)} · ` : ''}
                  {doc.createdAt ? formatShortDate(doc.createdAt) : ''}
                </p>
                {preview && <p className="text-muted-foreground line-clamp-1 text-sm">{preview}</p>}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
