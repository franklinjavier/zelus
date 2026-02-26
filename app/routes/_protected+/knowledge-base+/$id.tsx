import { ArrowUpRightIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { BackButton } from '~/components/layout/back-button'
import { orgContext } from '~/lib/auth/context'
import { getDocument, getDocumentTitle } from '~/lib/services/documents'
import type { Route } from './+types/$id'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc || doc.status !== 'ready') throw new Response('Not Found', { status: 404 })
  return { doc }
}

const typeLabel = { file: 'Ficheiro', article: 'Artigo', url: 'Fonte externa' } as const

export default function KnowledgeBaseDetail({ loaderData }: Route.ComponentProps) {
  const { doc } = loaderData

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackButton to={href('/knowledge-base')} />

      <div className="mt-4 mb-4 flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{getDocumentTitle(doc)}</h1>
        <Badge variant="secondary">{typeLabel[doc.type]}</Badge>
      </div>

      {doc.type === 'article' && doc.body && (
        <div className="max-w-none text-sm leading-relaxed whitespace-pre-wrap">{doc.body}</div>
      )}

      {doc.type === 'file' && doc.fileUrl && (
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1.5 hover:underline"
        >
          <HugeiconsIcon icon={ArrowUpRightIcon} size={16} />
          Abrir ficheiro
        </a>
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
