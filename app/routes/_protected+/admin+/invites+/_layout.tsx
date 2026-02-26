import {
  Copy01Icon,
  CopyLinkIcon,
  MailSend02Icon,
  RefreshIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { eq } from 'drizzle-orm'
import { useState } from 'react'
import { data, Form, href, Link, Outlet, useFetcher, useMatches, useNavigate } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { ErrorBanner } from '~/components/layout/feedback'
import { roleLabel } from '~/components/shared/role-badge'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from '~/components/ui/drawer'
import { Input } from '~/components/ui/input'
import { orgContext, userContext } from '~/lib/auth/context'
import { db } from '~/lib/db'
import { organization } from '~/lib/db/schema'
import {
  disableInviteLink,
  enableInviteLink,
  regenerateInviteCode,
} from '~/lib/services/invite-link.server'
import { listInvites, revokeInvite } from '~/lib/services/invites.server'
import { setToast } from '~/lib/toast.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/_layout'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Convites — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const org = await db
    .select({
      inviteCode: organization.inviteCode,
      inviteEnabled: organization.inviteEnabled,
    })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
    .then((rows) => rows[0])
  const invitesList = await listInvites(orgId)
  if (!org) throw new Response('Not Found', { status: 404 })

  return { invites: invitesList, org, origin: new URL(request.url).origin }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  if (fields.intent === 'toggle-invite') {
    const currentlyEnabled = fields.enabled === 'true'
    if (currentlyEnabled) {
      await disableInviteLink(orgId)
    } else {
      await enableInviteLink(orgId)
    }
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (fields.intent === 'regenerate-invite') {
    await regenerateInviteCode(orgId)
    return data({ success: true }, { headers: await setToast('Link regenerado.') })
  }

  if (fields.intent === 'revoke-invite') {
    const inviteId = fields.inviteId as string
    if (!inviteId) return { error: 'Convite não especificado.' }

    try {
      await revokeInvite(orgId, inviteId, user.id)
      return data({ success: true }, { headers: await setToast('Convite revogado.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao revogar convite.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/5 ring-amber-500/10',
  default: 'ring-foreground/5',
}

const statusIconStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  default: 'bg-muted text-muted-foreground',
}

export default function InvitesLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { invites, org, origin } = loaderData
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Convites</h1>
        <Button nativeButton={false} render={<Link to={href('/admin/invites/new')} />}>
          Novo convite
        </Button>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-4">
        <InviteLinkCard org={org} origin={origin} />
      </div>

      <div className="mt-6">
        {invites.length === 0 ? (
          <EmptyState icon={MailSend02Icon} message="Nenhum convite enviado" />
        ) : (
          <div className="@container flex flex-col gap-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className={cn(
                  'flex items-start gap-3 rounded-2xl p-3 ring-1 transition-colors @sm:items-center',
                  statusStyles[invite.status] ?? statusStyles.default,
                )}
              >
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    statusIconStyles[invite.status] ?? statusIconStyles.default,
                  )}
                >
                  <HugeiconsIcon icon={MailSend02Icon} size={18} strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium [overflow-wrap:anywhere] @sm:truncate">
                    {invite.email}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {invite.type === 'org' ? 'Condomínio' : (invite.fractionLabel ?? 'Fração')}
                    {' · '}
                    {roleLabel(invite.role)}
                  </p>
                  <div className="mt-2 flex items-center gap-2 @sm:hidden">
                    {invite.status === 'expired' && <Badge variant="destructive">Expirado</Badge>}
                    {invite.status === 'pending' && (
                      <>
                        <CopyLinkButton token={invite.token} />
                        <Form method="post">
                          <input type="hidden" name="intent" value="revoke-invite" />
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <Button type="submit" variant="destructive">
                            Revogar
                          </Button>
                        </Form>
                      </>
                    )}
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-2 @sm:flex">
                  {invite.status === 'expired' && <Badge variant="destructive">Expirado</Badge>}
                  {invite.status === 'pending' && (
                    <>
                      <CopyLinkButton token={invite.token} />
                      <Form method="post">
                        <input type="hidden" name="intent" value="revoke-invite" />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button type="submit" variant="destructive">
                          Revogar
                        </Button>
                      </Form>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/admin/invites'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>Novo convite</DrawerTitle>
            <DrawerDescription>Preencha os dados para enviar um convite.</DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}

function InviteLinkCard({
  org,
  origin,
}: {
  org: { inviteCode: string | null; inviteEnabled: boolean }
  origin: string
}) {
  const fetcher = useFetcher()
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const isSubmitting = fetcher.state !== 'idle'

  const isEnabled = fetcher.formData
    ? fetcher.formData.get('intent') === 'toggle-invite'
      ? fetcher.formData.get('enabled') !== 'true'
      : org.inviteEnabled
    : org.inviteEnabled

  const inviteUrl = org.inviteCode ? `${origin}/join/${org.inviteCode}` : null

  function copyLink() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Link de convite</CardTitle>
            <CardDescription>
              Partilhe este link para que novos membros possam juntar-se ao condomínio.
            </CardDescription>
          </div>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="toggle-invite" />
            <input type="hidden" name="enabled" value={String(org.inviteEnabled)} />
            <Button
              type="submit"
              variant={isEnabled ? 'outline' : 'default'}
              disabled={isSubmitting}
            >
              {isEnabled ? 'Desativar' : 'Ativar'}
            </Button>
          </fetcher.Form>
        </div>
      </CardHeader>
      {isEnabled && inviteUrl && (
        <CardContent>
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteUrl} className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyLink}>
              <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={2} />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              {copied ? 'Copiado!' : 'Qualquer pessoa com este link pode juntar-se.'}
            </p>
            {confirmRegen ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">O link atual será invalidado.</span>
                <fetcher.Form method="post" onSubmit={() => setConfirmRegen(false)}>
                  <input type="hidden" name="intent" value="regenerate-invite" />
                  <Button type="submit" variant="destructive" disabled={isSubmitting}>
                    Confirmar
                  </Button>
                </fetcher.Form>
                <Button variant="ghost" onClick={() => setConfirmRegen(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRegen(true)}>
                <HugeiconsIcon
                  icon={RefreshIcon}
                  data-icon="inline-start"
                  size={16}
                  strokeWidth={2}
                />
                Regenerar
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleCopy}
      aria-label="Copiar link do convite"
    >
      <HugeiconsIcon icon={copied ? Tick02Icon : CopyLinkIcon} size={16} />
      Copiar link
    </Button>
  )
}
