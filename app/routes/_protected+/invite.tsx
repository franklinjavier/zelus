import { useState } from 'react'
import { Copy01Icon, CheckmarkCircle01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/invite'
import { orgContext } from '~/lib/auth/context'
import { getInviteLink } from '~/lib/services/invite-link'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/layout/empty-state'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Convidar — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const link = await getInviteLink(orgId)
  const origin = new URL(request.url).origin
  const inviteUrl =
    link?.inviteEnabled && link.inviteCode ? `${origin}/join/${link.inviteCode}` : null
  return { inviteUrl }
}

export default function InvitePage({ loaderData }: Route.ComponentProps) {
  const { inviteUrl } = loaderData
  const [copied, setCopied] = useState(false)

  function copyLink() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Convidar</h1>

      <div className="mt-5">
        {inviteUrl ? (
          <div className="ring-foreground/5 rounded-2xl p-5 ring-1">
            <p className="text-sm">
              Partilhe este link com quem quiser convidar para o condomínio. Qualquer pessoa com o
              link pode pedir para se juntar.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="ring-foreground/10 text-foreground min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 font-mono text-sm ring-1 outline-none"
              />
              <Button variant="outline" size="default" onClick={copyLink} className="shrink-0">
                <HugeiconsIcon
                  icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
                  size={16}
                  strokeWidth={2}
                />
                {copied ? 'Copiado!' : 'Copiar link'}
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={UserAdd01Icon}
            message="O link de convite não está ativo. Fale com a administração para o ativar."
          />
        )}
      </div>
    </div>
  )
}
