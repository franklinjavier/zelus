import { ArrowUpRightIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href } from 'react-router'

import { BackButton } from '~/components/layout/back-button'
import { MarkdownContent } from '~/components/shared/markdown-content'
import { Badge } from '~/components/ui/badge'
import { orgContext } from '~/lib/auth/context'
import { signFileUrl } from '~/lib/file-token.server'
import { getDocumentTitle } from '~/lib/services/documents-display'
import { getDocument, getDocumentChunks } from '~/lib/services/documents.server'
import type { Route } from './+types/$id'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc || doc.status !== 'ready') throw new Response('Not Found', { status: 404 })

  const chunks = await getDocumentChunks(doc.id)
  const fullText = chunks.map((c) => c.content).join('\n\n') || null

  return {
    doc: doc.fileUrl ? { ...doc, fileUrl: signFileUrl(doc.fileUrl) } : doc,
    fullText,
  }
}

const typeLabel = { file: 'Ficheiro', article: 'Texto', url: 'Fonte externa' } as const

export default function DocumentsDetail({ loaderData }: Route.ComponentProps) {
  const { doc, fullText } = loaderData

  return (
    <>
      <BackButton to={href('/documents')} />

      <div className="mt-4 mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-xl font-semibold">{getDocumentTitle(doc)}</h1>
          <Badge variant="secondary" className="shrink-0">
            {typeLabel[doc.type]}
          </Badge>
        </div>
        {doc.type === 'file' && doc.fileUrl && (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex shrink-0 items-center gap-1 text-sm hover:underline"
          >
            <HugeiconsIcon icon={ArrowUpRightIcon} size={16} />
            Abrir ficheiro
          </a>
        )}
      </div>

      {doc.type === 'article' && doc.body && (
        <div className="max-w-none text-sm leading-relaxed whitespace-pre-wrap">{doc.body}</div>
      )}

      {doc.type === 'file' && doc.fileUrl && doc.mimeType?.startsWith('image/') && (
        <img
          src={doc.fileUrl}
          alt={getDocumentTitle(doc)}
          className="ring-foreground/5 max-h-[85vh] w-full rounded-2xl object-contain ring-1"
        />
      )}

      {doc.type === 'file' && fullText && (
        <div className="max-h-[70vh] overflow-y-auto">
          <MarkdownContent>{fullText}</MarkdownContent>
        </div>
      )}

      {doc.type === 'url' && (
        <div className="flex flex-col gap-4">
          {doc.sourceUrl && (
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1.5 hover:underline"
            >
              <HugeiconsIcon icon={ArrowUpRightIcon} size={16} />
              {doc.sourceUrl}
            </a>
          )}
          {fullText && (
            <div className="max-h-[70vh] overflow-y-auto">
              <MarkdownContent>{fullText}</MarkdownContent>
            </div>
          )}
        </div>
      )}
    </>
  )
}
