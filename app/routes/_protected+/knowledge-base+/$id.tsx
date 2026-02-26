import { useState } from 'react'
import { ArrowUpRightIcon, ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { BackButton } from '~/components/layout/back-button'
import { Button } from '~/components/ui/button'
import { orgContext } from '~/lib/auth/context'
import { getDocument, getDocumentChunks } from '~/lib/services/documents.server'
import { getDocumentTitle } from '~/lib/services/documents-display'
import { signFileUrl } from '~/lib/file-token.server'
import { MarkdownContent } from '~/components/shared/markdown-content'
import { cn } from '~/lib/utils'
import type { Route } from '../documents+/+types/$id'

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
  const [showExtracted, setShowExtracted] = useState(false)

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

      {doc.type === 'file' && doc.fileUrl && (
        <>
          {doc.mimeType === 'application/pdf' ? (
            <iframe
              src={doc.fileUrl}
              title={getDocumentTitle(doc)}
              className="ring-foreground/5 h-[85vh] w-full rounded-2xl ring-1"
            />
          ) : doc.mimeType?.startsWith('image/') ? (
            <img
              src={doc.fileUrl}
              alt={getDocumentTitle(doc)}
              className="ring-foreground/5 max-h-[85vh] w-full rounded-2xl object-contain ring-1"
            />
          ) : null}
        </>
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
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExtracted(!showExtracted)}
                className="w-fit"
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  strokeWidth={2}
                  className={cn('transition-transform', showExtracted && 'rotate-180')}
                />
                {showExtracted ? 'Ocultar' : 'Ver'} conteúdo extraído
              </Button>
              {showExtracted && (
                <div className="max-h-[70vh] overflow-y-auto">
                  <MarkdownContent>{fullText}</MarkdownContent>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
