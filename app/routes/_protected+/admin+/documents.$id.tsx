import { useState } from 'react'
import { href, data, useNavigate } from 'react-router'
import { Loading03Icon, Alert02Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/documents.$id'
import { orgContext } from '~/lib/auth/context'
import { getDocument, getDocumentChunks } from '~/lib/services/documents.server'
import { DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '~/components/ui/drawer'
import { Button } from '~/components/ui/button'
import { decodeHtmlEntities } from '~/lib/html-decode'
import { cn } from '~/lib/utils'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc) throw data('Documento não encontrado.', { status: 404 })

  let fullText: string | null = null
  if (doc.status === 'ready') {
    const chunks = await getDocumentChunks(doc.id)
    fullText = chunks.map((c) => c.content).join('\n\n')
  }

  return { doc, fullText }
}

export default function DocumentDetailDrawer({ loaderData }: Route.ComponentProps) {
  const { doc, fullText } = loaderData
  const navigate = useNavigate()
  const [showExtracted, setShowExtracted] = useState(false)

  return (
    <>
      <DrawerHeader>
        <DrawerTitle className="pr-8">{doc.type === 'url' ? doc.title : doc.fileName}</DrawerTitle>
        <DrawerDescription>
          {doc.type === 'url' && doc.sourceUrl ? (
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {doc.sourceUrl}
            </a>
          ) : (
            'Conteúdo extraído do documento'
          )}
        </DrawerDescription>
      </DrawerHeader>

      <div className="px-6 pb-2">
        {doc.status === 'processing' && (
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
            <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin" />
            <span>A extrair conteúdo…</span>
          </div>
        )}

        {doc.status === 'error' && (
          <div className="text-destructive flex flex-col items-center gap-3 py-12 text-sm">
            <HugeiconsIcon icon={Alert02Icon} size={24} />
            <span>Ocorreu um erro ao processar este documento.</span>
          </div>
        )}

        {doc.status === 'ready' && fullText && (
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExtracted(!showExtracted)}
              className="w-fit"
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                strokeWidth={2}
                className={cn('transition-transform', showExtracted && 'rotate-180')}
              />
              {showExtracted ? 'Ocultar' : 'Ver'} conteúdo extraído
            </Button>
            {showExtracted && (
              <pre className="bg-muted text-foreground max-h-[calc(100vh-220px)] overflow-y-auto rounded-lg p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
                {decodeHtmlEntities(fullText)}
              </pre>
            )}
          </div>
        )}

        {doc.status === 'ready' && !fullText && (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nenhum conteúdo extraído.
          </p>
        )}
      </div>

      <DrawerFooter>
        <Button variant="outline" onClick={() => navigate(href('/admin/documents'))}>
          Fechar
        </Button>
      </DrawerFooter>
    </>
  )
}
