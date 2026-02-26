import { BookOpen01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Form, Link, href } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { orgContext } from '~/lib/auth/context'
import { listReadyDocuments } from '~/lib/services/documents.server'
import { getDocumentTitle, getDocumentPreview } from '~/lib/services/documents-display'
import { EmptyState } from '~/components/layout/empty-state'
import type { Route } from './+types/index'

export function meta() {
  return [{ title: 'Base de Conhecimento — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  let docs = await listReadyDocuments(orgId)

  if (q) {
    const lower = q.toLowerCase()
    docs = docs.filter(
      (d) =>
        (d.title ?? d.fileName ?? '').toLowerCase().includes(lower) ||
        (d.body ?? '').toLowerCase().includes(lower),
    )
  }

  return { docs, query: q }
}

const typeLabel = {
  file: 'Ficheiro',
  article: 'Artigo',
  url: 'Fonte externa',
} as const

export default function KnowledgeBaseIndex({ loaderData }: Route.ComponentProps) {
  const { docs, query } = loaderData

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <HugeiconsIcon icon={BookOpen01Icon} size={24} className="text-primary" />
        <h1 className="text-xl font-semibold">Base de Conhecimento</h1>
      </div>

      <Form method="get" className="mb-6">
        <Input name="q" placeholder="Pesquisar..." defaultValue={query} className="h-10" />
      </Form>

      {docs.length === 0 ? (
        <EmptyState icon={BookOpen01Icon} message="Nenhum conteúdo disponível." />
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <Link
              key={doc.id}
              to={href('/knowledge-base/:id', { id: doc.id })}
              className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-1.5 rounded-2xl p-4 ring-1"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{getDocumentTitle(doc)}</span>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {typeLabel[doc.type]}
                </Badge>
              </div>
              {getDocumentPreview(doc) && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {getDocumentPreview(doc)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
