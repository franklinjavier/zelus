import { eq, and, or, sql, desc } from 'drizzle-orm'

import { db } from '~/lib/db'
import { tickets, ticketEvents, fractions, user } from '~/lib/db/schema'
import { logAuditEvent } from './audit'
import { createNotification } from './notifications'
import { sendEmail } from '~/lib/email/client'
import { ticketUpdateEmail } from '~/lib/email/templates/ticket-update'

export async function createTicket(
  orgId: string,
  data: {
    title: string
    description: string
    category?: string | null
    fractionId?: string | null
    priority?: 'urgent' | 'high' | 'medium' | 'low' | null
    private?: boolean
  },
  userId: string,
) {
  const [ticket] = await db
    .insert(tickets)
    .values({
      orgId,
      title: data.title,
      description: data.description,
      category: data.category ?? null,
      fractionId: data.fractionId ?? null,
      priority: data.priority ?? null,
      private: data.private ?? false,
      createdBy: userId,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticket.id,
    metadata: { title: data.title },
  })

  return ticket
}

export async function listTickets(
  orgId: string,
  userId: string,
  filters?: {
    status?: string
    priority?: string
    category?: string
    fractionId?: string
  },
) {
  const conditions = [
    eq(tickets.orgId, orgId),
    or(eq(tickets.private, false), and(eq(tickets.private, true), eq(tickets.createdBy, userId))),
  ]

  if (filters?.status) {
    conditions.push(
      eq(tickets.status, filters.status as (typeof tickets.status.enumValues)[number]),
    )
  }
  if (filters?.priority) {
    conditions.push(
      eq(tickets.priority, filters.priority as (typeof tickets.priority.enumValues)[number]),
    )
  }
  if (filters?.category) {
    conditions.push(eq(tickets.category, filters.category))
  }
  if (filters?.fractionId) {
    conditions.push(eq(tickets.fractionId, filters.fractionId))
  }

  const result = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      private: tickets.private,
      createdAt: tickets.createdAt,
      category: tickets.category,
      creatorName: user.name,
      fractionLabel: fractions.label,
    })
    .from(tickets)
    .innerJoin(user, eq(tickets.createdBy, user.id))
    .leftJoin(fractions, eq(tickets.fractionId, fractions.id))
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt))

  return result
}

export async function getTicket(orgId: string, ticketId: string, userId: string) {
  const [ticket] = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      private: tickets.private,
      createdBy: tickets.createdBy,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      category: tickets.category,
      fractionId: tickets.fractionId,
      creatorName: user.name,
      fractionLabel: fractions.label,
    })
    .from(tickets)
    .innerJoin(user, eq(tickets.createdBy, user.id))
    .leftJoin(fractions, eq(tickets.fractionId, fractions.id))
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .limit(1)

  if (!ticket) return null

  if (ticket.private && ticket.createdBy !== userId) {
    return null
  }

  return ticket
}

export async function updateTicket(
  orgId: string,
  ticketId: string,
  data: {
    title?: string
    description?: string
    category?: string | null
    priority?: 'urgent' | 'high' | 'medium' | 'low' | null
    private?: boolean
  },
  userId: string,
) {
  const [updated] = await db
    .update(tickets)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'ticket.updated',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: data,
    })
  }

  return updated ?? null
}

export async function updateTicketStatus(
  orgId: string,
  ticketId: string,
  newStatus: 'open' | 'in_progress' | 'resolved' | 'closed',
  userId: string,
) {
  const [current] = await db
    .select({ status: tickets.status })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .limit(1)

  if (!current) return null

  const fromStatus = current.status

  const [updated] = await db
    .update(tickets)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning()

  await db.insert(ticketEvents).values({
    orgId,
    ticketId,
    userId,
    fromStatus,
    toStatus: newStatus,
  })

  await logAuditEvent({
    orgId,
    userId,
    action: 'ticket.status_changed',
    entityType: 'ticket',
    entityId: ticketId,
    metadata: { from: fromStatus, to: newStatus },
  })

  // Notify ticket creator if someone else changed the status
  if (updated && updated.createdBy !== userId) {
    const [creator] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, updated.createdBy))
      .limit(1)

    await createNotification({
      orgId,
      userId: updated.createdBy,
      type: 'ticket_update',
      title: `Ocorrência atualizada — ${updated.title}`,
      message: `O estado foi alterado para "${newStatus}".`,
      metadata: { ticketId },
    })

    if (creator) {
      const emailData = ticketUpdateEmail({
        ticketTitle: updated.title,
        newStatus,
        ticketUrl: `${process.env.APP_URL ?? ''}/tickets/${ticketId}`,
      })
      sendEmail({ to: creator.email, ...emailData }).catch(() => {})
    }
  }

  return updated
}
