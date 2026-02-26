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
  Refresh01Icon,
  PinIcon,
  BookOpen01Icon,
  Link04Icon,
  TextIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/documents'
import { orgContext, userContext } from '~/lib/auth/context'
import { waitUntilContext } from '~/lib/vercel/context'
import {
  createDocument,
  createArticle,
  createUrlEntry,
  listDocuments,
  deleteDocument,
  resetDocumentForReprocessing,
  pinDocument,
} from '~/lib/services/documents.server'
import { getDocumentTitle } from '~/lib/services/documents-display'
import { processDocument, processArticle, processUrl } from '~/lib/ai/rag'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Drawer, DrawerPopup, DrawerTrigger } from '~/components/ui/drawer'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { EmptyState } from '~/components/layout/empty-state'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { ErrorBanner } from '~/components/layout/feedback'
import { formatShortDate } from '~/lib/format'
import { cn } from '~/lib/utils'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Base de Conhecimento — Zelus' }]
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

  if (intent === 'add-article') {
    const title = formData.get('title') as string
    const body = formData.get('body') as string

    if (!title?.trim() || !body?.trim()) {
      return { error: 'Título e conteúdo são obrigatórios.' }
    }

    const doc = await createArticle(orgId, { title: title.trim(), body: body.trim() }, userId)
    const backgroundProcess = context.get(waitUntilContext)
    backgroundProcess(processArticle(doc.id, orgId, body.trim()))
    return { success: true }
  }

  if (intent === 'add-url') {
    const title = formData.get('title') as string
    const sourceUrl = formData.get('sourceUrl') as string

    if (!title?.trim() || !sourceUrl?.trim()) {
      return { error: 'Título e URL são obrigatórios.' }
    }

    try {
      new URL(sourceUrl)
    } catch {
      return { error: 'URL inválido.' }
    }

    const doc = await createUrlEntry(
      orgId,
      { title: title.trim(), sourceUrl: sourceUrl.trim() },
      userId,
    )
    const backgroundProcess = context.get(waitUntilContext)
    backgroundProcess(processUrl(doc.id, orgId, sourceUrl.trim()))
    return { success: true }
  }

  if (intent === 'pin') {
    const documentId = formData.get('documentId') as string
    const pin = formData.get('pin') === 'true'
    await pinDocument(orgId, documentId, pin)
    return { success: true }
  }

  if (intent === 'reprocess') {
    const documentId = formData.get('documentId') as string
    try {
      const doc = await resetDocumentForReprocessing(orgId, documentId)
      const backgroundProcess = context.get(waitUntilContext)
      if (doc.type === 'file' && doc.fileUrl && doc.mimeType) {
        backgroundProcess(processDocument(documentId, orgId, doc.fileUrl, doc.mimeType))
      } else if (doc.type === 'article' && doc.body) {
        backgroundProcess(processArticle(documentId, orgId, doc.body))
      } else if (doc.type === 'url' && doc.sourceUrl) {
        backgroundProcess(processUrl(documentId, orgId, doc.sourceUrl))
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao reprocessar documento.' }
    }
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

const typeBadge = {
  file: { label: 'Ficheiro', className: 'bg-blue-50 text-blue-700' },
  article: { label: 'Artigo', className: 'bg-green-50 text-green-700' },
  url: { label: 'Fonte externa', className: 'bg-purple-50 text-purple-700' },
} as const

function TypeBadge({ type }: { type: 'file' | 'article' | 'url' }) {
  const cfg = typeBadge[type]
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

const typeIcon = {
  file: File02Icon,
  article: TextIcon,
  url: Link04Icon,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Base de Conhecimento</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Article drawer */}
          <Drawer>
            <DrawerTrigger
              className={cn(
                'ring-foreground/10 hover:bg-muted/50 inline-flex h-10 items-center gap-2 rounded-4xl px-4 text-sm font-medium ring-1',
              )}
            >
              <HugeiconsIcon icon={TextIcon} size={16} strokeWidth={2} />
              Novo Artigo
            </DrawerTrigger>
            <DrawerPopup className="sm:max-w-lg">
              <div className="p-4">
                <h2 className="mb-4 text-lg font-semibold">Novo Artigo</h2>
                <Form method="post">
                  <input type="hidden" name="intent" value="add-article" />
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label htmlFor="article-title">Título</Label>
                      <Input id="article-title" name="title" required className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="article-body">Conteúdo</Label>
                      <Textarea id="article-body" name="body" rows={8} required className="mt-1" />
                    </div>
                    <Button type="submit" className="w-full">
                      Guardar artigo
                    </Button>
                  </div>
                </Form>
              </div>
            </DrawerPopup>
          </Drawer>

          {/* URL drawer */}
          <Drawer>
            <DrawerTrigger
              className={cn(
                'ring-foreground/10 hover:bg-muted/50 inline-flex h-10 items-center gap-2 rounded-4xl px-4 text-sm font-medium ring-1',
              )}
            >
              <HugeiconsIcon icon={Link04Icon} size={16} strokeWidth={2} />
              Adicionar URL
            </DrawerTrigger>
            <DrawerPopup className="sm:max-w-lg">
              <div className="p-4">
                <h2 className="mb-4 text-lg font-semibold">Adicionar URL</h2>
                <Form method="post">
                  <input type="hidden" name="intent" value="add-url" />
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label htmlFor="url-title">Título</Label>
                      <Input
                        id="url-title"
                        name="title"
                        required
                        placeholder="Ex: Regulamento Municipal"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="url-source">URL</Label>
                      <Input
                        id="url-source"
                        name="sourceUrl"
                        type="url"
                        required
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Adicionar
                    </Button>
                  </div>
                </Form>
              </div>
            </DrawerPopup>
          </Drawer>

          {/* File upload */}
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
              <HugeiconsIcon
                icon={Upload04Icon}
                data-icon="inline-start"
                size={16}
                strokeWidth={2}
              />
              {uploading ? `A enviar... ${uploadProgress}%` : 'Carregar ficheiro'}
            </Button>
          </div>
        </div>
      </div>

      {uploadError && <ErrorBanner className="mt-4">{uploadError}</ErrorBanner>}

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="@container mt-5 flex flex-col gap-2">
        {documents.length === 0 ? (
          <EmptyState icon={BookOpen01Icon} message="Nenhum conteúdo na base de conhecimento." />
        ) : (
          documents.map((doc) => {
            const status = statusConfig[doc.status]
            const icon = typeIcon[doc.type]
            return (
              <div
                key={doc.id}
                className="ring-foreground/5 flex items-start gap-3 rounded-2xl p-3 ring-1 @sm:items-center"
              >
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <HugeiconsIcon icon={icon} size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium [overflow-wrap:anywhere] @sm:truncate">
                      {getDocumentTitle(doc)}
                    </span>
                    <TypeBadge type={doc.type} />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {doc.type === 'file' && doc.fileSize
                      ? `${formatFileSize(doc.fileSize)} · `
                      : ''}
                    {formatShortDate(doc.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {status && (
                    <div className={cn('flex items-center gap-1 text-sm', status.className)}>
                      <HugeiconsIcon icon={status.icon} size={14} />
                      <span>{status.label}</span>
                    </div>
                  )}
                  <Form method="post">
                    <input type="hidden" name="intent" value="pin" />
                    <input type="hidden" name="documentId" value={doc.id} />
                    <input type="hidden" name="pin" value={doc.pinnedAt ? 'false' : 'true'} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={doc.pinnedAt ? 'Desafixar destaque' : 'Fixar no destaque'}
                      className={doc.pinnedAt ? 'text-amber-500' : ''}
                    >
                      <HugeiconsIcon icon={PinIcon} size={16} />
                    </Button>
                  </Form>
                  {doc.type === 'file' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={<Link to={href('/admin/documents/:id', { id: doc.id })} />}
                      aria-label="Ver conteúdo extraído"
                    >
                      <HugeiconsIcon icon={EyeIcon} size={16} />
                    </Button>
                  )}
                  {doc.status !== 'processing' && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="reprocess" />
                      <input type="hidden" name="documentId" value={doc.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Reprocessar documento"
                      >
                        <HugeiconsIcon icon={Refresh01Icon} size={16} />
                      </Button>
                    </Form>
                  )}
                  <DeleteConfirmDialog
                    title="Apagar entrada?"
                    description={`Tem a certeza que quer apagar "${getDocumentTitle(doc)}"? Os dados do RAG associados também serão removidos.`}
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
