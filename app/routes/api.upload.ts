import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

import type { Route } from './+types/api.upload'
import { sessionContext } from '~/lib/auth/context'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  if (!session?.user) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const body = (await request.json()) as HandleUploadBody

  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
      maximumSizeInBytes: 10 * 1024 * 1024,
      addRandomSuffix: true,
    }),
  })

  return Response.json(response)
}
