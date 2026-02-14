import { HugeiconsIcon } from '@hugeicons/react'
import {
  Ticket02Icon,
  Alert02Icon,
  Building06Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'

import { href } from 'react-router'

import type { Route } from './+types/dashboard'
import { orgContext } from '~/lib/auth/context'
import { CardLink } from '~/components/brand/card-link'
import { db } from '~/lib/db'
import { tickets, fractions, suppliers, maintenanceRecords } from '~/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Painel — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)

  const [[ticketCount], [openTickets], [fractionCount], [supplierCount], [maintenanceCount]] =
    await Promise.all([
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
    ])

  return {
    stats: {
      totalTickets: ticketCount?.count ?? 0,
      openTickets: openTickets?.count ?? 0,
      totalFractions: fractionCount?.count ?? 0,
      totalSuppliers: supplierCount?.count ?? 0,
      totalMaintenance: maintenanceCount?.count ?? 0,
    },
  }
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { stats } = loaderData

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Painel</h1>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Ocorrências"
          value={stats.totalTickets}
          icon={Ticket02Icon}
          href={href('/tickets')}
        />
        <StatTile
          label="Abertas"
          value={stats.openTickets}
          icon={Alert02Icon}
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
  return (
    <CardLink to={href} className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-3xl font-medium tracking-tight tabular-nums">{value}</p>
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mt-1 text-sm font-medium">{label}</p>
    </CardLink>
  )
}
