import { put } from '@vercel/blob'

import type { Route } from './+types/api.upload'
import { sessionContext } from '~/lib/auth/context'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES = [
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

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Nenhum ficheiro enviado.' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'Ficheiro excede o limite de 10 MB.' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return Response.json(
      { error: 'Tipo de ficheiro não permitido. Envie imagens, PDFs ou documentos Office.' },
      { status: 400 },
    )
  }

  const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true })

  return Response.json({
    url: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  })
}
