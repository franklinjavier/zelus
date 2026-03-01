import {
  Add01Icon,
  BookOpen01Icon,
  Link04Icon,
  TextIcon,
  Upload04Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { Form } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { ErrorBanner } from '~/components/layout/feedback'
import { DocumentsList } from '~/components/shared/documents-list'
import { Button } from '~/components/ui/button'
import { Drawer, DrawerPopup } from '~/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { processArticle, processDocument, processUrl } from '~/lib/ai/rag'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  createArticle,
  createDocument,
  createUrlEntry,
  listReadyDocuments,
} from '~/lib/services/documents.server'
import { uploadFile } from '~/lib/upload'
import { waitUntilContext } from '~/lib/vercel/context'
import type { Route } from './+types/index'

export function meta() {
  return [{ title: 'Documentos — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  let docs = await listReadyDocuments(orgId)

  if (q) {
    const lower = q.toLowerCase()
    docs = docs.filter(
      (d) =>
        (d.title ?? d.fileName ?? '').toLowerCase().includes(lower) ||
        (d.body ?? '').toLowerCase().includes(lower),
    )
  }

  return { docs, query: q, isAdmin: effectiveRole === 'org_admin' }
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

    return { success: true, intent: 'upload' as const }
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
    return { success: true, intent: 'add-article' as const }
  }

  if (intent === 'add-url') {
    const title = formData.get('title') as string
    const sourceUrl = formData.get('sourceUrl') as string

    if (!title?.trim() || !sourceUrl?.trim()) {
      return { error: 'Título e URL são obrigatórios.' }
    }

    try {
      const parsed = new URL(sourceUrl)
      if (parsed.protocol !== 'https:') {
        return { error: 'Apenas URLs HTTPS são permitidos.' }
      }
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
    return { success: true, intent: 'add-url' as const }
  }

  return { error: 'Ação inválida.' }
}

export default function DocumentsIndex({ loaderData, actionData }: Route.ComponentProps) {
  const { docs, query, isAdmin } = loaderData
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [openDrawer, setOpenDrawer] = useState<'article' | 'url' | null>(null)

  useEffect(() => {
    if (
      actionData &&
      'intent' in actionData &&
      (actionData.intent === 'add-article' || actionData.intent === 'add-url')
    ) {
      setOpenDrawer(null)
    }
  }, [actionData])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    try {
      const blob = await uploadFile(file, {
        access: 'private',
        pathname: `documents/${file.name}`,
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

        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            {uploading ? (
              <Button variant="outline" disabled>
                <HugeiconsIcon
                  icon={Upload04Icon}
                  size={16}
                  strokeWidth={2}
                  className="animate-pulse"
                />
                A enviar… {uploadProgress}%
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="outline">
                    <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
                    Adicionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setOpenDrawer('article')}>
                    <HugeiconsIcon icon={TextIcon} size={16} strokeWidth={2} />
                    <span>Texto</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOpenDrawer('url')}>
                    <HugeiconsIcon icon={Link04Icon} size={16} strokeWidth={2} />
                    <span>Site URL</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => document.getElementById('doc-file-upload')?.click()}
                  >
                    <HugeiconsIcon icon={Upload04Icon} size={16} strokeWidth={2} />
                    <span>Ficheiro</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <input
              type="file"
              id="doc-file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileSelect}
              disabled={uploading}
            />

            {/* Article drawer */}
            <Drawer
              open={openDrawer === 'article'}
              onOpenChange={(open) => !open && setOpenDrawer(null)}
            >
              <DrawerPopup className="sm:max-w-lg">
                <div
                  className="p-4"
                  data-swipe-ignore
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <h2 className="mb-4 text-lg font-semibold">Novo Texto</h2>
                  <Form method="post">
                    <input type="hidden" name="intent" value="add-article" />
                    <div className="flex flex-col gap-4">
                      <div>
                        <Label htmlFor="doc-article-title">Título</Label>
                        <Input id="doc-article-title" name="title" required className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="doc-article-body">Conteúdo</Label>
                        <Textarea
                          id="doc-article-body"
                          name="body"
                          rows={8}
                          required
                          className="mt-1"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Guardar texto
                      </Button>
                    </div>
                  </Form>
                </div>
              </DrawerPopup>
            </Drawer>

            {/* URL drawer */}
            <Drawer
              open={openDrawer === 'url'}
              onOpenChange={(open) => !open && setOpenDrawer(null)}
            >
              <DrawerPopup className="sm:max-w-lg">
                <div
                  className="p-4"
                  data-swipe-ignore
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <h2 className="mb-4 text-lg font-semibold">Adicionar URL</h2>
                  <Form method="post">
                    <input type="hidden" name="intent" value="add-url" />
                    <div className="flex flex-col gap-4">
                      <div>
                        <Label htmlFor="doc-url-title">Título</Label>
                        <Input
                          id="doc-url-title"
                          name="title"
                          required
                          placeholder="Ex: Regulamento Municipal"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="doc-url-source">URL</Label>
                        <Input
                          id="doc-url-source"
                          name="sourceUrl"
                          type="text"
                          inputMode="url"
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
          </div>
        )}
      </div>

      {uploadError && <ErrorBanner className="mt-0 mb-4">{uploadError}</ErrorBanner>}

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-0 mb-4">{actionData.error}</ErrorBanner>
      )}

      <Form method="get" className="mb-6">
        <Input name="q" placeholder="Pesquisar..." defaultValue={query} className="h-10" />
      </Form>

      {docs.length === 0 ? (
        <EmptyState icon={BookOpen01Icon} message="Nenhum conteúdo disponível." />
      ) : (
        <DocumentsList docs={docs} />
      )}
    </>
  )
}
