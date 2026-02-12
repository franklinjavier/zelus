import { Outlet, redirect, useLocation } from 'react-router'
import { eq } from 'drizzle-orm'

import type { Route } from './+types/_layout'
import { requireAuth } from '~/lib/auth/rbac'
import { auth } from '~/lib/auth/auth.server'
import { db } from '~/lib/db'
import { member } from '~/lib/db/schema'

import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'

function forwardCookies(res: Response): Headers {
  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

export function meta() {
  return [{ title: 'Configurar Condomínio — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { session, user } = requireAuth(context)
  const url = new URL(request.url)
  const pathname = url.pathname

  // If user already has an active org and is on the initial steps, redirect to dashboard
  if (session.session.activeOrganizationId) {
    if (pathname === '/onboarding' || pathname === '/onboarding/org') {
      throw redirect('/dashboard')
    }
    // On /onboarding/fractions or /onboarding/done, allow through — wizard in progress
    return null
  }

  // No active org — check if user already has a membership somewhere
  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, user.id))
    .limit(1)

  if (memberships.length > 0) {
    const res = await auth.api.setActiveOrganization({
      body: { organizationId: memberships[0].organizationId },
      asResponse: true,
      headers: request.headers,
    })
    throw redirect('/dashboard', { headers: forwardCookies(res) })
  }

  return null
}

const stepMeta: Record<string, { title: string; description: string }> = {
  '/onboarding/org': {
    title: 'Configurar condomínio',
    description: 'Passo 1 de 3 — Dados do condomínio',
  },
  '/onboarding/fractions': {
    title: 'Adicionar frações',
    description: 'Passo 2 de 3 — Frações do edifício',
  },
  '/onboarding/done': {
    title: 'Tudo pronto!',
    description: 'Passo 3 de 3 — Configuração concluída',
  },
}

export default function OnboardingLayout() {
  const { pathname } = useLocation()
  const step = stepMeta[pathname] ?? stepMeta['/onboarding/org']

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Outlet />
        </CardContent>
      </Card>
    </div>
  )
}
