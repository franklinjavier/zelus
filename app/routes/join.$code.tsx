import { redirect, Form, Link, href } from 'react-router'
import { eq, and } from 'drizzle-orm'

import type { Route } from './+types/join.$code'
import { auth } from '~/lib/auth/auth.server'
import { sessionContext } from '~/lib/auth/context'
import { getOrgByInviteCode } from '~/lib/services/invite-link'
import { setToast } from '~/lib/toast.server'
import { db } from '~/lib/db'
import { member } from '~/lib/db/schema'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ErrorBanner } from '~/components/layout/feedback'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData || 'error' in loaderData) {
    return [{ title: 'Link Inválido — Zelus' }]
  }
  return [{ title: `Juntar-se a ${loaderData.org.name} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const org = await getOrgByInviteCode(params.code)

  if (!org || !org.inviteEnabled) {
    return { error: 'invalid' as const }
  }

  const session = context.get(sessionContext)

  if (!session) {
    return { org, code: params.code, authenticated: false as const, alreadyMember: false as const }
  }

  const [existing] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)))
    .limit(1)

  if (existing) {
    return { org, code: params.code, authenticated: true as const, alreadyMember: true as const }
  }

  return { org, code: params.code, authenticated: true as const, alreadyMember: false as const }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  if (!session) {
    throw redirect(`${href('/login')}?redirect=${href('/join/:code', { code: params.code })}`)
  }

  const org = await getOrgByInviteCode(params.code)
  if (!org || !org.inviteEnabled) {
    return { error: 'Este link não é válido ou foi desativado.' }
  }

  // Check if already a member
  const [existing] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, org.id), eq(member.userId, session.user.id)))
    .limit(1)

  if (existing) {
    // Already a member — just switch to this org and redirect
    const res = await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      asResponse: true,
      headers: request.headers,
    })
    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }
    return redirect(href('/dashboard'), { headers })
  }

  try {
    // Insert new member
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: session.user.id,
      role: 'member',
      createdAt: new Date(),
    })

    // Set active organization
    const res = await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      asResponse: true,
      headers: request.headers,
    })

    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }
    const toastHeaders = await setToast('Bem-vindo ao condomínio!')
    headers.append('set-cookie', toastHeaders['set-cookie'])

    return redirect(href('/dashboard'), { headers })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao juntar-se ao condomínio.' }
  }
}

export default function JoinPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>Juntar-se ao Condomínio</CardTitle>
          {'error' in loaderData ? (
            <CardDescription>Este link não é válido.</CardDescription>
          ) : (
            <CardDescription>{loaderData.org.name}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {actionData && 'error' in actionData && (
            <ErrorBanner className="mb-4">{actionData.error}</ErrorBanner>
          )}

          {'error' in loaderData && (
            <div className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-center text-sm">
              Este link não é válido ou foi desativado.
            </div>
          )}

          {!('error' in loaderData) && loaderData.alreadyMember && (
            <div className="grid gap-3">
              <div className="bg-muted rounded-xl px-3 py-2 text-center text-sm">
                Já é membro deste condomínio.
              </div>
              <Button
                size="lg"
                nativeButton={false}
                render={<Link to={href('/dashboard')} />}
                className="w-full"
              >
                Ir para o painel
              </Button>
            </div>
          )}

          {!('error' in loaderData) && loaderData.authenticated && !loaderData.alreadyMember && (
            <Form method="post">
              <Button type="submit" size="lg" className="w-full">
                Juntar-se
              </Button>
            </Form>
          )}

          {!('error' in loaderData) && !loaderData.authenticated && (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-center text-sm">
                Inicie sessão para se juntar ao condomínio.
              </p>
              <Button
                size="lg"
                nativeButton={false}
                render={
                  <Link
                    to={`${href('/login')}?redirect=${href('/join/:code', { code: loaderData.code })}`}
                  />
                }
              >
                Entrar
              </Button>
              <Button
                size="lg"
                nativeButton={false}
                render={
                  <Link
                    to={`${href('/register')}?redirect=${href('/join/:code', { code: loaderData.code })}`}
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
