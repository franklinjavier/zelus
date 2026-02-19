import { useEffect, useRef, useState } from 'react'
import {
  Building06Icon,
  Copy01Icon,
  Link01Icon,
  Tick02Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { href } from 'react-router'

import { and, count, eq } from 'drizzle-orm'
import { AzulejoOverlay } from '~/components/brand/azulejo-overlay'
import { CardLink } from '~/components/brand/card-link'
import { Button } from '~/components/ui/button'
import { orgContext } from '~/lib/auth/context'
import { db } from '~/lib/db'
import { fractions, maintenanceRecords, suppliers, tickets } from '~/lib/db/schema'
import { getInviteLink } from '~/lib/services/invite-link'
import type { Route } from './+types/dashboard'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Painel Admin — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const origin = new URL(request.url).origin

  const [
    [ticketCount],
    [openTickets],
    [fractionCount],
    [supplierCount],
    [maintenanceCount],
    inviteLink,
  ] = await Promise.all([
    db.select({ count: count() }).from(tickets).where(eq(tickets.orgId, orgId)),
    db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.status, 'open'))),
    db.select({ count: count() }).from(fractions).where(eq(fractions.orgId, orgId)),
    db.select({ count: count() }).from(suppliers).where(eq(suppliers.orgId, orgId)),
    db
      .select({ count: count() })
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.orgId, orgId)),
    getInviteLink(orgId),
  ])

  const joinCode = inviteLink?.inviteEnabled ? inviteLink.inviteCode : null
  const joinUrl = joinCode ? `${origin}${href('/join/:code', { code: joinCode })}` : null

  return {
    stats: {
      totalTickets: ticketCount?.count ?? 0,
      openTickets: openTickets?.count ?? 0,
      totalFractions: fractionCount?.count ?? 0,
      totalSuppliers: supplierCount?.count ?? 0,
      totalMaintenance: maintenanceCount?.count ?? 0,
    },
    joinUrl,
  }
}

export default function AdminDashboardPage({ loaderData }: Route.ComponentProps) {
  const { stats, joinUrl } = loaderData

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Painel</h1>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <StatTile
          label="Ocorrências"
          value={stats.totalTickets}
          icon={Ticket02Icon}
          href={href('/tickets')}
        />
        <StatTile
          label="Frações"
          value={stats.totalFractions}
          icon={Building06Icon}
          href={href('/fractions')}
        />
        <StatTile
          label="Fornecedores"
          value={stats.totalSuppliers}
          icon={TruckDeliveryIcon}
          href={href('/suppliers')}
        />
        <StatTile
          label="Manutenções"
          value={stats.totalMaintenance}
          icon={WrenchIcon}
          href={href('/maintenance')}
        />
      </div>

      {joinUrl && <InviteLinkCard url={joinUrl} />}
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
  href,
}: {
  label: string
  value: number
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  href: string
}) {
  const display = useCountUp(value, 400)

  return (
    <CardLink to={href} className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-3xl font-medium tracking-tight tabular-nums">{display}</p>
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mt-1 text-sm font-medium">{label}</p>
    </CardLink>
  )
}

function useCountUp(target: number, duration = 400) {
  const [current, setCurrent] = useState(0)
  const ref = useRef({ start: 0, raf: 0 })

  useEffect(() => {
    if (target === 0) return
    ref.current.start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - ref.current.start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setCurrent(Math.round(eased * target))
      if (progress < 1) ref.current.raf = requestAnimationFrame(tick)
    }
    ref.current.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current.raf)
  }, [target, duration])

  return current
}

function InviteLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group bg-card ring-foreground/10 hover:ring-primary/20 relative mt-6 overflow-hidden rounded-2xl p-5 ring-1 transition-all duration-300">
      <AzulejoOverlay />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
            <HugeiconsIcon icon={Link01Icon} size={18} strokeWidth={2} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Convidar para o condomínio</p>
            <p className="text-muted-foreground text-sm">
              Partilhe este link para novos membros se juntarem.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="bg-muted flex-1 truncate rounded-xl px-3 py-2 font-mono text-sm">
            {url}
          </div>
          <Button variant="outline" size="sm" onClick={copy}>
            <HugeiconsIcon
              icon={copied ? Tick02Icon : Copy01Icon}
              data-icon="inline-start"
              size={16}
              strokeWidth={2}
            />
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
