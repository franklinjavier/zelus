import {
  AiChat02Icon,
  BookOpen01Icon,
  Search01Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href } from 'react-router'
import type { IconSvgElement } from '@hugeicons/react'

import { Badge } from '~/components/ui/badge'
import { orgContext } from '~/lib/auth/context'
import {
  getKnowledgeBaseHighlights,
  getDocumentTitle,
  getDocumentPreview,
} from '~/lib/services/documents'
import type { Route } from './+types/home'

export function meta() {
  return [{ title: 'Início — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const highlights = await getKnowledgeBaseHighlights(orgId, 6)
  return { highlights }
}

const shortcuts: Array<{
  label: string
  description: string
  to: string
  icon: IconSvgElement
}> = [
  {
    label: 'Assistente',
    description: 'Tire dúvidas com o assistente IA',
    to: href('/assistant'),
    icon: AiChat02Icon,
  },
  {
    label: 'Ocorrências',
    description: 'Reporte ou acompanhe problemas',
    to: href('/tickets'),
    icon: Ticket02Icon,
  },
  {
    label: 'Prestadores',
    description: 'Contactos de fornecedores',
    to: href('/suppliers'),
    icon: TruckDeliveryIcon,
  },
  {
    label: 'Intervenções',
    description: 'Histórico de manutenções',
    to: href('/maintenance'),
    icon: WrenchIcon,
  },
  {
    label: 'Base de Conhecimento',
    description: 'Artigos e documentos úteis',
    to: href('/knowledge-base'),
    icon: BookOpen01Icon,
  },
  {
    label: 'Pesquisa',
    description: 'Pesquise em todo o conteúdo',
    to: href('/search'),
    icon: Search01Icon,
  },
]

const typeLabel = { file: 'Ficheiro', article: 'Artigo', url: 'Fonte externa' } as const

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { highlights } = loaderData

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">Início</h1>

      {/* Feature shortcuts */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3 @sm:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-2 rounded-2xl p-4 ring-1"
            >
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                <HugeiconsIcon icon={s.icon} size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-muted-foreground text-sm">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Knowledge base highlights */}
      {highlights.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Destaques</h2>
            <Link to={href('/knowledge-base')} className="text-primary text-sm hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {highlights.map((doc) => (
              <Link
                key={doc.id}
                to={href('/knowledge-base/:id', { id: doc.id })}
                className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-1 rounded-2xl p-3 ring-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{getDocumentTitle(doc)}</span>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {typeLabel[doc.type]}
                  </Badge>
                </div>
                {getDocumentPreview(doc) && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {getDocumentPreview(doc)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
