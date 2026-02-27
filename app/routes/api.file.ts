import { get } from '@vercel/blob'

import type { Route } from './+types/api.file'
import { sessionContext } from '~/lib/auth/context'
import { verifyFileToken } from '~/lib/file-token.server'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  if (!session?.user) throw new Response('Unauthorized', { status: 401 })

  const token = new URL(request.url).searchParams.get('t')
  if (!token) throw new Response('Bad Request', { status: 400 })

  const blobUrl = verifyFileToken(token)
  if (!blobUrl) throw new Response('Forbidden', { status: 403 })

  const result = await get(blobUrl, {
    access: 'private',
    token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN,
  })

  if (!result) {
    throw new Response('Not Found', { status: 404 })
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=900',
    },
  })
}
