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

import { DocumentsList } from '~/components/shared/documents-list'
import { orgContext, userContext } from '~/lib/auth/context'
import { getDocumentsHighlights } from '~/lib/services/documents.server'
import type { Route } from './+types/home'
import { CardLink } from '~/components/brand/card-link'

export function meta() {
  return [{ title: 'Início — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)

  const highlights = await getDocumentsHighlights(orgId, 6)
  return {
    highlights,
    user: { name: user.name },
  }
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
    description: 'Contactos de prestadores de serviço',
    to: href('/suppliers'),
    icon: TruckDeliveryIcon,
  },
  {
    label: 'Intervenções',
    description: 'Histórico de manutenções, reparos e melhorias',
    to: href('/maintenance'),
    icon: WrenchIcon,
  },
  {
    label: 'Documentos',
    description: 'Atas, regulamentos, manuais e outros documentos importantes',
    to: href('/documents'),
    icon: BookOpen01Icon,
  },
  {
    label: 'Pesquisa',
    description: 'Pesquise em todo o conteúdo',
    to: href('/search'),
    icon: Search01Icon,
  },
]

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { highlights, user } = loaderData

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Bem-vindo, {user.name}</h1>

      {/* Feature shortcuts */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shortcuts.map((s) => (
            <CardLink key={s.to} to={s.to}>
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                <HugeiconsIcon icon={s.icon} size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-muted-foreground text-sm">{s.description}</p>
              </div>
            </CardLink>
          ))}
        </div>
      </section>

      {/* Documents highlights */}
      {highlights.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Documentos</h2>
            <Link to={href('/documents')} className="text-primary text-sm hover:underline">
              Ver todos
            </Link>
          </div>
          <DocumentsList docs={highlights} />
        </section>
      )}
    </>
  )
}
