import { redirect, Form, Link, href } from 'react-router'

import type { Route } from './+types/invite.$token'
import { auth } from '~/lib/auth/auth.server'
import { sessionContext } from '~/lib/auth/context'
import { getInviteByToken, acceptInvite } from '~/lib/services/invites'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ErrorBanner } from '~/components/layout/feedback'
import { RoleBadge } from '~/components/shared/role-badge'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.invite ? 'Aceitar Convite — Zelus' : 'Convite — Zelus' }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const invite = await getInviteByToken(params.token)

  if (!invite) {
    throw new Response('Convite não encontrado.', { status: 404 })
  }

  if (invite.status !== 'pending') {
    return {
      invite,
      expired: invite.status === 'expired',
      accepted: invite.status === 'accepted',
      authenticated: false,
    }
  }

  if (invite.expiresAt < new Date()) {
    return { invite, expired: true, accepted: false, authenticated: false }
  }

  const session = context.get(sessionContext)

  return {
    invite,
    expired: false,
    accepted: false,
    authenticated: !!session,
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  if (!session)
    throw redirect(`${href('/login')}?redirect=${href('/invite/:token', { token: params.token })}`)

  try {
    const invite = await acceptInvite(params.token, session.user.id)

    const res = await auth.api.setActiveOrganization({
      body: { organizationId: invite.orgId },
      asResponse: true,
      headers: request.headers,
    })

    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }

    return redirect(href('/dashboard'), { headers })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao aceitar convite.' }
  }
}

export default function InvitePage({ loaderData, actionData }: Route.ComponentProps) {
  const { invite, expired, accepted, authenticated } = loaderData

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>Convite Zelus</CardTitle>
          <CardDescription>
            {invite.type === 'org'
              ? 'Convite para a organização'
              : `Convite para a fração ${invite.fractionLabel ?? ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted mb-4 rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{invite.email}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Papel</span>
              <RoleBadge role={invite.role} />
            </div>
          </div>

          {actionData?.error && <ErrorBanner className="mb-4">{actionData.error}</ErrorBanner>}

          {accepted && (
            <div className="bg-muted rounded-xl px-3 py-2 text-center text-sm">
              Este convite já foi aceite.
            </div>
          )}

          {expired && !accepted && (
            <div className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-center text-sm">
              Este convite expirou.
            </div>
          )}

          {!expired && !accepted && authenticated && (
            <Form method="post">
              <Button type="submit" className="w-full">
                Aceitar convite
              </Button>
            </Form>
          )}

          {!expired && !accepted && !authenticated && (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-center text-sm">
                Inicie sessão para aceitar o convite.
              </p>
              <Button
                render={
                  <Link
                    to={`${href('/login')}?redirect=${href('/invite/:token', { token: invite.token })}&email=${encodeURIComponent(invite.email)}`}
                  />
                }
              >
                Entrar
              </Button>
              <Button
                render={
                  <Link
                    to={`${href('/register')}?redirect=${href('/invite/:token', { token: invite.token })}&email=${encodeURIComponent(invite.email)}`}
                  />
                }
                variant="outline"
              >
                Criar conta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
