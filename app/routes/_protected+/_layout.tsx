import { eq } from 'drizzle-orm'
import { isRouteErrorResponse, Outlet } from 'react-router'

import type { Route } from './+types/_layout'
import { orgMemberMiddleware } from '~/lib/auth/middleware'
import { orgContext, userContext } from '~/lib/auth/context'
import { AppShell } from '~/components/layout/app-shell'
import { ErrorContent } from '~/components/brand/error-page'
import { db } from '~/lib/db'
import { member, organization } from '~/lib/db/schema'
import { getUnreadCount } from '~/lib/services/notifications'

export const middleware: Route.MiddlewareFunction[] = [orgMemberMiddleware]

export async function loader({ context }: Route.LoaderArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  const [unreadCount, userOrgs] = await Promise.all([
    getUnreadCount(org.orgId, user.id),
    db
      .select({ id: organization.id, name: organization.name })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, user.id)),
  ])

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
    org: { id: org.orgId, name: org.orgName },
    orgs: userOrgs,
    isOrgAdmin: org.effectiveRole === 'org_admin',
    unreadCount,
  }
}

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell
      user={loaderData.user}
      org={loaderData.org}
      orgs={loaderData.orgs}
      isOrgAdmin={loaderData.isOrgAdmin}
      unreadCount={loaderData.unreadCount}
    >
      <Outlet />
    </AppShell>
  )
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  const errorContent = isRouteErrorResponse(error) ? (
    <ErrorContent
      title={error.status === 404 ? 'Página não encontrada' : 'Algo correu mal'}
      message={
        error.status === 404
          ? 'A página que procura não existe ou foi movida.'
          : error.statusText || 'Ocorreu um erro inesperado.'
      }
    />
  ) : (
    <ErrorContent
      title="Algo correu mal"
      message="Ocorreu um erro inesperado."
      stack={import.meta.env.DEV && error instanceof Error ? error.stack : undefined}
    />
  )

  if (loaderData) {
    return (
      <AppShell
        user={loaderData.user}
        org={loaderData.org}
        orgs={loaderData.orgs}
        isOrgAdmin={loaderData.isOrgAdmin}
        unreadCount={loaderData.unreadCount}
      >
        {errorContent}
      </AppShell>
    )
  }

  return errorContent
}
