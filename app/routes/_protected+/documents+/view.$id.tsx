import { data } from 'react-router'

import { orgContext } from '~/lib/auth/context'
import { getDocument, getDocumentChunks } from '~/lib/services/documents.server'
import type { Route } from './+types/view.$id'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc) throw data('Documento não encontrado.', { status: 404 })

  let fullText: string | null = null
  if (doc.status === 'ready') {
    const chunks = await getDocumentChunks(doc.id)
    fullText = chunks.map((c) => c.content).join('\n\n')
  }

  return { doc, fullText }
}
