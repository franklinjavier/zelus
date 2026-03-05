import {
  AiChat02Icon,
  BookOpen01Icon,
  Calendar03Icon,
  Search01Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href } from 'react-router'
import type { IconSvgElement } from '@hugeicons/react'

import { Badge } from '~/components/ui/badge'
import { DocumentsList } from '~/components/shared/documents-list'
import { orgContext, userContext } from '~/lib/auth/context'
import { getActiveAnnouncements } from '~/lib/services/announcements.server'
import { getDocumentsHighlights } from '~/lib/services/documents.server'
import { formatEventDate } from '~/lib/format'
import type { Route } from './+types/home'
import { CardLink } from '~/components/brand/card-link'

export function meta() {
  return [{ title: 'Início — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)

  const [highlights, activeAnnouncements] = await Promise.all([
    getDocumentsHighlights(orgId, 6),
    getActiveAnnouncements(orgId, 5),
  ])

  return {
    highlights,
    activeAnnouncements,
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
  const { highlights, activeAnnouncements, user } = loaderData

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Bem-vindo, {user.name}</h1>

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">Avisos</h2>
          <div className="flex flex-col gap-2">
            {activeAnnouncements.map((a) => (
              <div
                key={a.id}
                className="bg-primary/5 ring-primary/10 flex items-start gap-3 rounded-2xl p-4 ring-1"
              >
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    size={18}
                    strokeWidth={1.5}
                    className="text-primary"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.recurrence && (
                      <Badge variant="secondary" className="shrink-0">
                        {(a.recurrence as { frequency: string }).frequency === 'weekly'
                          ? 'Semanal'
                          : 'Mensal'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-primary/70 mt-0.5 text-sm">
                    {formatEventDate(a.nextOccurrence!)}
                  </p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature shortcuts */}
      <section className="@container mb-8">
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
          {shortcuts.map((s) => (
            <CardLink key={s.to} to={s.to} className="min-h-28">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 text-left">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-5 @xl:line-clamp-2">
                    {s.description}
                  </p>
                </div>
                <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                  <HugeiconsIcon icon={s.icon} size={20} className="text-primary" />
                </div>
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
