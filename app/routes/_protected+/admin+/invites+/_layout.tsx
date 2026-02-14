import { useState } from 'react'
import { data, Form, Link, Outlet, useMatches, useNavigate, href } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { CopyLinkIcon, Tick02Icon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import { listInvites, revokeInvite } from '~/lib/services/invites'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { roleLabel } from '~/components/shared/role-badge'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Convites — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const invitesList = await listInvites(orgId)
  return { invites: invitesList }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

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

export default function InvitesLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { invites } = loaderData
  const navigate = useNavigate()
  const matches = useMatches()
  const hasChildRoute =
    matches.length > 0 &&
    matches[matches.length - 1]?.id !== matches.find((m) => m.pathname === '/admin/invites')?.id
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Convites</h1>
        <Button render={<Link to={href('/admin/invites/new')} />}>Novo convite</Button>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Convites enviados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invites.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                Nenhum convite enviado.
              </p>
            ) : (
              <div className="divide-y">
                {invites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invite.email}</p>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
                        <span>
                          {invite.type === 'org'
                            ? 'Organização'
                            : (invite.fractionLabel ?? 'Fração')}
                        </span>
                        <span>&middot;</span>
                        <span>{roleLabel(invite.role)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={invite.status} />
                      {invite.status === 'pending' && (
                        <>
                          <CopyLinkButton token={invite.token} />
                          <Form method="post">
                            <input type="hidden" name="intent" value="revoke-invite" />
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                            >
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
          </CardContent>
        </Card>
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
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label="Copiar link do convite"
    >
      <HugeiconsIcon icon={copied ? Tick02Icon : CopyLinkIcon} size={16} />
    </Button>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') return <Badge variant="default">Aceite</Badge>
  if (status === 'pending') return <Badge variant="secondary">Pendente</Badge>
  return <Badge variant="destructive">Expirado</Badge>
}
