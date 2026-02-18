import { Form, useNavigation } from 'react-router'
import { useState } from 'react'
import {
  File02Icon,
  Upload04Icon,
  Clock01Icon,
  Tick02Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/documents'
import { orgContext, userContext } from '~/lib/auth/context'
import { createDocument, listDocuments, deleteDocument } from '~/lib/services/documents'
import { processDocument } from '~/lib/ai/rag'
import { Button } from '~/components/ui/button'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { EmptyState } from '~/components/layout/empty-state'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { ErrorBanner } from '~/components/layout/feedback'
import { formatDate } from '~/lib/format'
import { cn } from '~/lib/utils'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Documentos — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const docs = await listDocuments(orgId)
  return { documents: docs }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'upload') {
    const fileUrl = formData.get('fileUrl') as string
    const fileName = formData.get('fileName') as string
    const fileSize = Number(formData.get('fileSize'))
    const mimeType = formData.get('mimeType') as string

    if (!fileUrl || !fileName) {
      return { error: 'Dados do ficheiro em falta.' }
    }

    const doc = await createDocument(orgId, { fileName, fileUrl, fileSize, mimeType }, userId)

    // Trigger async processing (fire-and-forget)
    processDocument(doc.id, orgId, fileUrl, mimeType).catch(console.error)

    return { success: true }
  }

  if (intent === 'delete') {
    const documentId = formData.get('documentId') as string
    try {
      await deleteDocument(orgId, documentId, userId)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar documento.' }
    }
    return { success: true }
  }

  return { error: 'Ação inválida.' }
}

const statusConfig = {
  processing: { icon: Clock01Icon, label: 'A processar', className: 'text-amber-600' },
  ready: { icon: Tick02Icon, label: 'Pronto', className: 'text-emerald-600' },
  error: { icon: Alert02Icon, label: 'Erro', className: 'text-destructive' },
} as const

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminDocumentsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { documents } = loaderData
  const navigation = useNavigation()
  const [uploading, setUploading] = useState(false)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Upload to Vercel Blob via existing API
      const uploadForm = new FormData()
      uploadForm.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: uploadForm })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      // Save document record via form action
      const form = document.createElement('form')
      form.method = 'POST'
      form.style.display = 'none'

      const fields = {
        intent: 'upload',
        fileUrl: data.url,
        fileName: data.fileName,
        fileSize: String(data.fileSize),
        mimeType: data.mimeType,
      }

      for (const [key, value] of Object.entries(fields)) {
        const input = document.createElement('input')
        input.name = key
        input.value = value
        form.appendChild(input)
      }

      document.body.appendChild(form)
      form.requestSubmit()
      document.body.removeChild(form)
    } catch {
      // Error handled by actionData
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Documentos</h1>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Button
            variant="default"
            size="lg"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploading}
          >
            <HugeiconsIcon icon={Upload04Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            {uploading ? 'A enviar...' : 'Carregar documento'}
          </Button>
        </div>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {documents.length === 0 ? (
          <EmptyState icon={File02Icon} message="Nenhum documento carregado." />
        ) : (
          documents.map((doc) => {
            const status = statusConfig[doc.status]
            return (
              <div
                key={doc.id}
                className="ring-foreground/5 flex items-center gap-3 rounded-2xl p-3 ring-1"
              >
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <HugeiconsIcon icon={File02Icon} size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.fileName}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatFileSize(doc.fileSize)} &middot; {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className={cn('flex items-center gap-1 text-sm', status.className)}>
                  <HugeiconsIcon icon={status.icon} size={14} />
                  <span>{status.label}</span>
                </div>
                <DeleteConfirmDialog
                  title="Apagar documento?"
                  description={`Tem a certeza que quer apagar "${doc.fileName}"? Os dados do RAG associados também serão removidos.`}
                >
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="documentId" value={doc.id} />
                    <AlertDialogAction type="submit">Apagar</AlertDialogAction>
                  </Form>
                </DeleteConfirmDialog>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
