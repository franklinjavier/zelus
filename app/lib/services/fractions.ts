import { eq, and, count, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { fractions, userFractions, tickets, invites } from '~/lib/db/schema'
import { logAuditEvent } from './audit'

export async function createFraction(
  orgId: string,
  data: { label: string; description?: string | null },
  adminUserId: string,
) {
  const [existing] = await db
    .select({ id: fractions.id })
    .from(fractions)
    .where(and(eq(fractions.orgId, orgId), eq(fractions.label, data.label)))
    .limit(1)

  if (existing) {
    throw new Error('Já existe uma fração com este nome.')
  }

  const [fraction] = await db
    .insert(fractions)
    .values({
      orgId,
      label: data.label,
      description: data.description ?? null,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'fraction.created',
    entityType: 'fraction',
    entityId: fraction.id,
    metadata: { label: data.label },
  })

  return fraction
}

export async function listFractions(orgId: string) {
  const result = await db
    .select({
      id: fractions.id,
      label: fractions.label,
      description: fractions.description,
      createdAt: fractions.createdAt,
      memberCount: count(userFractions.id),
    })
    .from(fractions)
    .leftJoin(
      userFractions,
      and(eq(userFractions.fractionId, fractions.id), eq(userFractions.status, 'approved')),
    )
    .where(eq(fractions.orgId, orgId))
    .groupBy(fractions.id)
    .orderBy(fractions.label)

  return result
}

export async function getFraction(orgId: string, fractionId: string) {
  const [fraction] = await db
    .select()
    .from(fractions)
    .where(and(eq(fractions.id, fractionId), eq(fractions.orgId, orgId)))
    .limit(1)

  return fraction ?? null
}

export async function updateFraction(
  orgId: string,
  fractionId: string,
  data: { label?: string; description?: string | null },
  adminUserId: string,
) {
  if (data.label) {
    const [existing] = await db
      .select({ id: fractions.id })
      .from(fractions)
      .where(
        and(
          eq(fractions.orgId, orgId),
          eq(fractions.label, data.label),
          sql`${fractions.id} != ${fractionId}`,
        ),
      )
      .limit(1)

    if (existing) {
      throw new Error('Já existe uma fração com este nome.')
    }
  }

  const [updated] = await db
    .update(fractions)
    .set({ ...data, updatedAt: sql`now()` })
    .where(and(eq(fractions.id, fractionId), eq(fractions.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'fraction.updated',
      entityType: 'fraction',
      entityId: fractionId,
      metadata: data,
    })
  }

  return updated ?? null
}

export async function deleteFraction(orgId: string, fractionId: string, adminUserId: string) {
  // Remove all user-fraction associations
  await db
    .delete(userFractions)
    .where(and(eq(userFractions.fractionId, fractionId), eq(userFractions.orgId, orgId)))

  // Unlink tickets referencing this fraction
  await db
    .update(tickets)
    .set({ fractionId: null })
    .where(and(eq(tickets.fractionId, fractionId), eq(tickets.orgId, orgId)))

  // Unlink invites referencing this fraction
  await db
    .update(invites)
    .set({ fractionId: null })
    .where(and(eq(invites.fractionId, fractionId), eq(invites.orgId, orgId)))

  const [deleted] = await db
    .delete(fractions)
    .where(and(eq(fractions.id, fractionId), eq(fractions.orgId, orgId)))
    .returning()

  if (deleted) {
    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'fraction.deleted',
      entityType: 'fraction',
      entityId: fractionId,
      metadata: { label: deleted.label },
    })
  }

  return deleted ?? null
}
