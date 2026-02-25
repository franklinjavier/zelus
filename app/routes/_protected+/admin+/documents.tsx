import { Form, useRevalidator, useLocation, useNavigate, Outlet, href, Link } from 'react-router'
import { upload } from '@vercel/blob/client'
import { useState, useEffect } from 'react'
import {
  File02Icon,
  Upload04Icon,
  Clock01Icon,
  Alert02Icon,
  Delete02Icon,
  EyeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/documents'
import { orgContext, userContext } from '~/lib/auth/context'
import { waitUntilContext } from '~/lib/vercel/context'
import { createDocument, listDocuments, deleteDocument } from '~/lib/services/documents'
import { processDocument } from '~/lib/ai/rag'
import { Button } from '~/components/ui/button'
import { Drawer, DrawerPopup } from '~/components/ui/drawer'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { EmptyState } from '~/components/layout/empty-state'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { ErrorBanner } from '~/components/layout/feedback'
import { formatShortDate } from '~/lib/format'
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

    const backgroundProcess = context.get(waitUntilContext)
    backgroundProcess(processDocument(doc.id, orgId, fileUrl, mimeType))

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
  ready: null,
  error: { icon: Alert02Icon, label: 'Erro', className: 'text-destructive' },
} as const

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminDocumentsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { documents } = loaderData
  const revalidator = useRevalidator()
  const hasProcessing = documents.some((d) => d.status === 'processing')
  const [uploading, setUploading] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isDrawerOpen = /\/admin\/documents\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    if (!hasProcessing) return
    const interval = setInterval(() => revalidator.revalidate(), 5000)
    return () => clearInterval(interval)
  }, [hasProcessing, revalidator])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    try {
      const blob = await upload(`documents/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/document-upload',
        multipart: true,
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      })

      // Save document record + trigger background processing via form action
      const form = document.createElement('form')
      form.method = 'POST'
      form.style.display = 'none'

      const fields = {
        intent: 'upload',
        fileUrl: blob.url,
        fileName: file.name,
        fileSize: String(file.size),
        mimeType: file.type || 'application/octet-stream',
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
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar ficheiro.')
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
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
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
            {uploading ? `A enviar... ${uploadProgress}%` : 'Carregar documento'}
          </Button>
        </div>
      </div>

      {uploadError && <ErrorBanner className="mt-4">{uploadError}</ErrorBanner>}

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="@container mt-5 flex flex-col gap-2">
        {documents.length === 0 ? (
          <EmptyState icon={File02Icon} message="Nenhum documento carregado." />
        ) : (
          documents.map((doc) => {
            const status = statusConfig[doc.status]
            return (
              <div
                key={doc.id}
                className="ring-foreground/5 flex items-start gap-3 rounded-2xl p-3 ring-1 @sm:items-center"
              >
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl"
                >
                  <HugeiconsIcon icon={File02Icon} size={18} className="text-primary" />
                </a>
                <div className="min-w-0 flex-1">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium [overflow-wrap:anywhere] hover:underline @sm:truncate"
                  >
                    {doc.fileName}
                  </a>
                  <p className="text-muted-foreground text-sm">
                    {formatFileSize(doc.fileSize)} &middot; {formatShortDate(doc.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {status && (
                    <div className={cn('flex items-center gap-1 text-sm', status.className)}>
                      <HugeiconsIcon icon={status.icon} size={14} />
                      <span>{status.label}</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link to={href('/admin/documents/:id', { id: doc.id })} />}
                    aria-label="Ver conteúdo extraído"
                  >
                    <HugeiconsIcon icon={EyeIcon} size={16} />
                  </Button>
                  <DeleteConfirmDialog
                    title="Apagar documento?"
                    description={`Tem a certeza que quer apagar "${doc.fileName}"? Os dados do RAG associados também serão removidos.`}
                  >
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="documentId" value={doc.id} />
                      <AlertDialogAction type="submit" className="sm:hidden" size="icon">
                        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                        <span className="sr-only">Apagar</span>
                      </AlertDialogAction>
                      <AlertDialogAction type="submit" className="max-sm:hidden">
                        Apagar
                      </AlertDialogAction>
                    </Form>
                  </DeleteConfirmDialog>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/admin/documents'))
        }}
      >
        <DrawerPopup className="sm:max-w-2xl">
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}
