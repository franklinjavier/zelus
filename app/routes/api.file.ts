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

  const blobResponse = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  })

  if (!blobResponse.ok) throw new Response('Not Found', { status: 404 })

  return new Response(blobResponse.body, {
    headers: {
      'Content-Type': blobResponse.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': blobResponse.headers.get('Content-Disposition') ?? 'inline',
      'Cache-Control': 'private, max-age=900',
    },
  })
}
