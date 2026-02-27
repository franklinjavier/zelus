import { put } from '@vercel/blob'

import type { Route } from './+types/api.upload-server'
import { sessionContext } from '~/lib/auth/context'

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  if (!session?.user) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const access = (formData.get('access') as string) || 'public'
  const pathname = (formData.get('pathname') as string) || undefined

  if (!(file instanceof File)) {
    return Response.json({ error: 'Ficheiro em falta.' }, { status: 400 })
  }

  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return Response.json({ error: 'Tipo de ficheiro não permitido.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Ficheiro demasiado grande (máx. 10 MB).' }, { status: 400 })
  }

  const isPrivate = access === 'private'

  try {
    const blob = await put(pathname ?? file.name, file, {
      access: isPrivate ? 'private' : 'public',
      addRandomSuffix: true,
      token: isPrivate ? process.env.BLOB_PRIVATE_READ_WRITE_TOKEN : undefined,
    })

    return Response.json({ url: blob.url })
  } catch (err) {
    console.error('[upload-server]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro ao carregar ficheiro.' },
      { status: 500 },
    )
  }
}
