import { BookOpen01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Form } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { DocumentUpload } from '~/components/shared/document-upload'
import { DocumentsList } from '~/components/shared/documents-list'
import { Input } from '~/components/ui/input'
import { orgContext, userContext } from '~/lib/auth/context'
import { handleDocumentCreation, listReadyDocuments } from '~/lib/services/documents.server'
import { waitUntilContext } from '~/lib/vercel/context'
import type { Route } from './+types/index'

export function meta() {
  return [{ title: 'Documentos — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
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

  return { docs, query: q, isAdmin: effectiveRole === 'org_admin' }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)
  const formData = await request.formData()
  const backgroundProcess = context.get(waitUntilContext)
  return handleDocumentCreation(formData, orgId, userId, backgroundProcess)
}

export default function DocumentsIndex({ loaderData }: Route.ComponentProps) {
  const { docs, query, isAdmin } = loaderData

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={BookOpen01Icon} size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground text-sm">
              Atas, regulamentos, manuais e outros documentos importantes
            </p>
          </div>
        </div>

        {isAdmin && <DocumentUpload />}
      </div>

      <Form method="get" className="mb-6">
        <Input name="q" placeholder="Pesquisar..." defaultValue={query} className="h-10" />
      </Form>

      {docs.length === 0 ? (
        <EmptyState icon={BookOpen01Icon} message="Nenhum conteúdo disponível." />
      ) : (
        <DocumentsList docs={docs} />
      )}
    </>
  )
}
