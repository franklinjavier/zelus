import { Add01Icon, Link04Icon, TextIcon, Upload04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { Form, useActionData } from 'react-router'

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
import { ErrorBanner } from '~/components/layout/feedback'
import { uploadFile } from '~/lib/upload'

type ActionData =
  | { success: true; intent: 'upload' | 'add-article' | 'add-url' }
  | { error: string }
  | undefined

export function DocumentUpload() {
  const actionData = useActionData<ActionData>()
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
              <DropdownMenuItem onClick={() => document.getElementById('doc-file-upload')?.click()}>
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
        <Drawer open={openDrawer === 'url'} onOpenChange={(open) => !open && setOpenDrawer(null)}>
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

      {uploadError && <ErrorBanner className="mt-4">{uploadError}</ErrorBanner>}

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}
    </>
  )
}
