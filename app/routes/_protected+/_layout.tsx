import { isRouteErrorResponse, Outlet } from 'react-router'

import type { Route } from './+types/_layout'
import { orgMemberMiddleware } from '~/lib/auth/middleware'
import { orgContext, userContext } from '~/lib/auth/context'
import { AppShell } from '~/components/layout/app-shell'
import { ErrorContent } from '~/components/brand/error-page'

export const middleware: Route.MiddlewareFunction[] = [orgMemberMiddleware]

export function loader({ context }: Route.LoaderArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: null as string | null,
    },
    orgId: org.orgId,
    isOrgAdmin: org.effectiveRole === 'org_admin',
  }
}

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell user={loaderData.user} isOrgAdmin={loaderData.isOrgAdmin}>
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
      // In the authenticated app shell, send the user back to the dashboard.
      homeHref="/dashboard"
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
      <AppShell user={loaderData.user} isOrgAdmin={loaderData.isOrgAdmin}>
        {errorContent}
      </AppShell>
    )
  }

  return errorContent
}
