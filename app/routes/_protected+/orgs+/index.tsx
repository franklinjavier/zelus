import { eq } from 'drizzle-orm'
import { Building06Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useFetcher, href } from 'react-router'

import type { Route } from './+types/index'
import { userContext, orgContext } from '~/lib/auth/context'
import { db } from '~/lib/db'
import { member, organization } from '~/lib/db/schema'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/layout/empty-state'

export function meta() {
  return [{ title: 'Condomínios — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)
  const { orgId } = context.get(orgContext)

  const userOrgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      city: organization.city,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, user.id))

  return { orgs: userOrgs, activeOrgId: orgId }
}

export default function OrgsPage({ loaderData }: Route.ComponentProps) {
  const { orgs, activeOrgId } = loaderData
  const fetcher = useFetcher()

  if (orgs.length === 0) {
    return (
      <EmptyState icon={Building06Icon} message="Nenhum condomínio encontrado">
        <Button render={<Link to={href('/orgs/new')} />} nativeButton={false}>
          Criar condomínio
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Condomínios</h1>
        <Button render={<Link to={href('/orgs/new')} />} nativeButton={false} size="sm">
          Criar condomínio
        </Button>
      </div>

      <ul className="mt-6 grid gap-3">
        {orgs.map((org) => {
          const isActive = org.id === activeOrgId
          return (
            <li
              key={org.id}
              className="bg-card ring-foreground/10 flex items-center gap-4 rounded-2xl p-4 ring-1"
            >
              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                <HugeiconsIcon
                  icon={Building06Icon}
                  size={20}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{org.name}</p>
                {org.city && <p className="text-muted-foreground truncate text-sm">{org.city}</p>}
              </div>
              {isActive ? (
                <span className="text-primary text-sm font-medium">Ativo</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetcher.submit(
                      { organizationId: org.id },
                      { method: 'post', action: href('/api/switch-org') },
                    )
                  }}
                >
                  Mudar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
