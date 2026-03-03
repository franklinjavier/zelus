import {
  Alert02Icon,
  BookOpen01Icon,
  Clock01Icon,
  Delete02Icon,
  EyeIcon,
  File02Icon,
  Link04Icon,
  PinIcon,
  Refresh01Icon,
  TextIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect } from 'react'
import { Form, href, Link, Outlet, useLocation, useNavigate, useRevalidator } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { DocumentUpload } from '~/components/shared/document-upload'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Drawer, DrawerPopup } from '~/components/ui/drawer'
import { Input } from '~/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { processArticle, processDocument, processUrl } from '~/lib/ai/rag'
import { orgContext, userContext } from '~/lib/auth/context'
import { signFileUrl } from '~/lib/file-token.server'
import { formatFileSize, formatShortDate } from '~/lib/format'
import { getDocumentTitle } from '~/lib/services/documents-display'
import {
  deleteDocument,
  handleDocumentCreation,
  listDocuments,
  listReadyDocuments,
  pinDocument,
  resetDocumentForReprocessing,
} from '~/lib/services/documents.server'
import { cn } from '~/lib/utils'
import { waitUntilContext } from '~/lib/vercel/context'
import type { Route } from './+types/index'

export function meta() {
  return [{ title: 'Documentos — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const isAdmin = effectiveRole === 'org_admin'
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  let docs = isAdmin ? await listDocuments(orgId) : await listReadyDocuments(orgId)

  if (q) {
    const lower = q.toLowerCase()
    docs = docs.filter(
      (d) =>
        (d.title ?? d.fileName ?? '').toLowerCase().includes(lower) ||
        (d.body ?? '').toLowerCase().includes(lower),
    )
  }

  return {
    documents: docs.map((doc) => ({
      ...doc,
      signedFileUrl: doc.fileUrl ? signFileUrl(doc.fileUrl) : null,
    })),
    query: q,
    isAdmin,
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'upload' || intent === 'add-article' || intent === 'add-url') {
    const backgroundProcess = context.get(waitUntilContext)
    return handleDocumentCreation(formData, orgId, userId, backgroundProcess)
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
  article: { label: 'Texto', className: 'bg-green-50 text-green-700' },
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

export default function DocumentsIndex({ loaderData }: Route.ComponentProps) {
  const { documents, query, isAdmin } = loaderData
  const revalidator = useRevalidator()
  const hasProcessing = documents.some((d) => d.status === 'processing')
  const location = useLocation()
  const navigate = useNavigate()
  const isDrawerOpen = /\/documents\/view\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    if (!hasProcessing) return
    const interval = setInterval(() => revalidator.revalidate(), 5000)
    return () => clearInterval(interval)
  }, [hasProcessing, revalidator])

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

      {documents.length === 0 ? (
        <EmptyState
          icon={BookOpen01Icon}
          message={isAdmin ? 'Nenhum documento adicionado.' : 'Nenhum conteúdo disponível.'}
        />
      ) : (
        <div className="@container flex flex-col gap-2">
          {documents.map((doc) => {
            const status = statusConfig[doc.status]
            const icon = typeIcon[doc.type]

            if (!isAdmin) {
              return (
                <Link
                  key={doc.id}
                  to={href('/documents/:id', { id: doc.id })}
                  className="ring-foreground/5 hover:bg-muted/30 flex flex-col gap-3 rounded-2xl p-3 ring-1 transition-colors @md:flex-row @md:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3 @md:items-center">
                    <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                      <HugeiconsIcon icon={icon} size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
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
                  </div>
                </Link>
              )
            }

            return (
              <div
                key={doc.id}
                className="ring-foreground/5 flex flex-col gap-3 rounded-2xl p-3 ring-1 @md:flex-row @md:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 @md:items-center">
                  <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <HugeiconsIcon icon={icon} size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {doc.signedFileUrl || doc.sourceUrl ? (
                        <a
                          href={doc.signedFileUrl || doc.sourceUrl || ''}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {getDocumentTitle(doc)}
                        </a>
                      ) : (
                        <span className="truncate text-sm font-medium">
                          {getDocumentTitle(doc)}
                        </span>
                      )}
                      <TypeBadge type={doc.type} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {doc.type === 'file' && doc.fileSize
                        ? `${formatFileSize(doc.fileSize)} · `
                        : ''}
                      {formatShortDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 @md:shrink-0 @md:flex-row @md:items-center">
                  {status && (
                    <div
                      className={cn(
                        'flex items-center gap-1 text-sm @md:shrink-0',
                        status.className,
                      )}
                    >
                      <HugeiconsIcon icon={status.icon} size={14} />
                      <span>{status.label}</span>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <Tooltip>
                      <Form method="post">
                        <input type="hidden" name="intent" value="pin" />
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="pin" value={doc.pinnedAt ? 'false' : 'true'} />
                        <TooltipTrigger
                          render={
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              className={doc.pinnedAt ? 'text-amber-500' : ''}
                            />
                          }
                        >
                          <HugeiconsIcon icon={PinIcon} size={16} />
                        </TooltipTrigger>
                      </Form>
                      <TooltipContent>
                        {doc.pinnedAt ? 'Desafixar destaque' : 'Fixar no destaque'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            nativeButton={false}
                            render={<Link to={href('/documents/view/:id', { id: doc.id })} />}
                          />
                        }
                      >
                        <HugeiconsIcon icon={EyeIcon} size={16} />
                      </TooltipTrigger>
                      <TooltipContent>Ver conteúdo</TooltipContent>
                    </Tooltip>
                    {doc.status !== 'processing' && (
                      <Tooltip>
                        <Form method="post">
                          <input type="hidden" name="intent" value="reprocess" />
                          <input type="hidden" name="documentId" value={doc.id} />
                          <TooltipTrigger
                            render={<Button type="submit" variant="ghost" size="icon-sm" />}
                          >
                            <HugeiconsIcon icon={Refresh01Icon} size={16} />
                          </TooltipTrigger>
                        </Form>
                        <TooltipContent>Reprocessar</TooltipContent>
                      </Tooltip>
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
              </div>
            )
          })}
        </div>
      )}

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/documents'))
        }}
      >
        <DrawerPopup className="sm:max-w-2xl">
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </>
  )
}
