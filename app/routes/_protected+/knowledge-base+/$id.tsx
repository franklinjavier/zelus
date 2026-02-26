import { ArrowUpRightIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { BackButton } from '~/components/layout/back-button'
import { orgContext } from '~/lib/auth/context'
import { getDocument } from '~/lib/services/documents.server'
import { getDocumentTitle } from '~/lib/services/documents-display'
import { signFileUrl } from '~/lib/file-token.server'
import type { Route } from './+types/$id'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc || doc.status !== 'ready') throw new Response('Not Found', { status: 404 })
  return {
    doc: doc.fileUrl ? { ...doc, fileUrl: signFileUrl(doc.fileUrl) } : doc,
  }
}

const typeLabel = { file: 'Ficheiro', article: 'Artigo', url: 'Fonte externa' } as const

export default function KnowledgeBaseDetail({ loaderData }: Route.ComponentProps) {
  const { doc } = loaderData

  return (
    <div className="px-4 py-6">
      <BackButton to={href('/knowledge-base')} />

      <div className="mt-4 mb-4 flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{getDocumentTitle(doc)}</h1>
        <Badge variant="secondary">{typeLabel[doc.type]}</Badge>
      </div>

      {doc.type === 'article' && doc.body && (
        <div className="max-w-none text-sm leading-relaxed whitespace-pre-wrap">{doc.body}</div>
      )}

      {doc.type === 'file' && doc.fileUrl && (
        <div className="flex flex-col gap-3">
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
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex items-center gap-1.5 text-sm hover:underline"
          >
            <HugeiconsIcon icon={ArrowUpRightIcon} size={16} />
            Abrir ficheiro
          </a>
        </div>
      )}

      {doc.type === 'url' && doc.sourceUrl && (
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
    </div>
  )
}
