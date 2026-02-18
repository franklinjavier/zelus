import { CopyLinkIcon, MailSend02Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { data, Form, href, Link, Outlet, useMatches, useNavigate } from 'react-router'

import { EmptyState } from '~/components/layout/empty-state'
import { ErrorBanner } from '~/components/layout/feedback'
import { roleLabel } from '~/components/shared/role-badge'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from '~/components/ui/drawer'
import { orgContext, userContext } from '~/lib/auth/context'
import { listInvites, revokeInvite } from '~/lib/services/invites'
import { setToast } from '~/lib/toast.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/_layout'

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

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/5 ring-amber-500/10 hover:bg-amber-500/10',
  accepted: 'bg-emerald-500/5 ring-emerald-500/10 hover:bg-emerald-500/10',
  default: 'bg-muted/50 ring-foreground/5 hover:bg-muted',
}

const statusIconStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  accepted: 'bg-emerald-500/10 text-emerald-600',
  default: 'bg-muted text-muted-foreground',
}

export default function InvitesLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { invites } = loaderData
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

      <div className="mt-6">
        {invites.length === 0 ? (
          <EmptyState icon={MailSend02Icon} message="Nenhum convite enviado" />
        ) : (
          <div className="flex flex-col gap-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-2xl p-5 ring-1 transition-colors',
                  statusStyles[invite.status] ?? statusStyles.default,
                )}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      statusIconStyles[invite.status] ?? statusIconStyles.default,
                    )}
                  >
                    <HugeiconsIcon icon={MailSend02Icon} size={18} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invite.email}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {invite.type === 'org' ? 'Condomínio' : (invite.fractionLabel ?? 'Fração')}
                      {' · '}
                      {roleLabel(invite.role)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
