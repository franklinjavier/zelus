import { BookOpen01Icon, File02Icon, TextIcon, Link04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Form, Link, href } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { orgContext } from '~/lib/auth/context'
import { listReadyDocuments } from '~/lib/services/documents.server'
import { getDocumentTitle } from '~/lib/services/documents-display'
import { formatShortDate, formatFileSize } from '~/lib/format'
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
  article: 'Texto',
  url: 'Fonte externa',
} as const

const typeIcon = {
  file: File02Icon,
  article: TextIcon,
  url: Link04Icon,
} as const

export default function KnowledgeBaseIndex({ loaderData }: Route.ComponentProps) {
  const { docs, query } = loaderData

  return (
    <>
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
        <div className="@container flex flex-col gap-2">
          {docs.map((doc) => {
            const icon = typeIcon[doc.type]
            return (
              <Link
                key={doc.id}
                to={href('/knowledge-base/:id', { id: doc.id })}
                className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-3 rounded-2xl p-3 ring-1 @sm:flex-row @sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 @sm:items-center">
                  <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <HugeiconsIcon icon={icon} size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{getDocumentTitle(doc)}</span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {typeLabel[doc.type]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {doc.type === 'file' && doc.fileSize
                        ? `${formatFileSize(doc.fileSize)} · `
                        : ''}
                      {formatShortDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
