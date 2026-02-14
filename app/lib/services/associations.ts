import { eq, and } from 'drizzle-orm'

import { db } from '~/lib/db'
import { userFractions, fractions, user, organization } from '~/lib/db/schema'
import { logAuditEvent } from './audit'
import { createNotification } from './notifications'
import { sendEmail } from '~/lib/email/client'
import { associationApprovedEmail } from '~/lib/email/templates/association-approved'
import { associationRejectedEmail } from '~/lib/email/templates/association-rejected'

export async function requestAssociation(orgId: string, userId: string, fractionId: string) {
  // Prevent duplicate pending/approved associations
  const [existing] = await db
    .select()
    .from(userFractions)
    .where(
      and(
        eq(userFractions.orgId, orgId),
        eq(userFractions.userId, userId),
        eq(userFractions.fractionId, fractionId),
      ),
    )
    .limit(1)

  if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
    throw new Error('Já existe um pedido de associação para esta fração.')
  }

  // If rejected before, allow re-request by inserting new
  const [association] = await db
    .insert(userFractions)
    .values({
      orgId,
      userId,
      fractionId,
      role: 'fraction_member',
      status: 'pending',
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'association.requested',
    entityType: 'user_fraction',
    entityId: association.id,
    metadata: { fractionId },
  })

  return association
}

export async function approveAssociation(
  orgId: string,
  associationId: string,
  adminUserId: string,
) {
  const [assoc] = await db
    .select()
    .from(userFractions)
    .where(and(eq(userFractions.id, associationId), eq(userFractions.orgId, orgId)))
    .limit(1)

  if (!assoc) throw new Error('Associação não encontrada.')
  if (assoc.status !== 'pending') throw new Error('Associação não está pendente.')

  // If role is fraction_owner_admin, check uniqueness
  if (assoc.role === 'fraction_owner_admin') {
    const [existingOwner] = await db
      .select()
      .from(userFractions)
      .where(
        and(
          eq(userFractions.fractionId, assoc.fractionId),
          eq(userFractions.orgId, orgId),
          eq(userFractions.role, 'fraction_owner_admin'),
          eq(userFractions.status, 'approved'),
        ),
      )
      .limit(1)

    if (existingOwner) {
      throw new Error('Já existe um administrador aprovado para esta fração.')
    }
  }

  const [updated] = await db
    .update(userFractions)
    .set({ status: 'approved', approvedBy: adminUserId, updatedAt: new Date() })
    .where(eq(userFractions.id, associationId))
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'association.approved',
    entityType: 'user_fraction',
    entityId: associationId,
    metadata: { userId: assoc.userId, fractionId: assoc.fractionId },
  })

  // Notify the user
  const [fraction] = await db
    .select({ label: fractions.label })
    .from(fractions)
    .where(eq(fractions.id, assoc.fractionId))
    .limit(1)
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  const [userData] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, assoc.userId))
    .limit(1)

  if (fraction && org && userData) {
    const fractionLabel = fraction.label
    await createNotification({
      orgId,
      userId: assoc.userId,
      type: 'association_approved',
      title: `Associação aprovada — ${fractionLabel}`,
      message: `A sua associação à fração ${fractionLabel} foi aprovada.`,
      metadata: { fractionId: assoc.fractionId },
    })

    const email = associationApprovedEmail({
      userName: userData.name,
      fractionLabel,
      orgName: org.name,
      fractionUrl: `${process.env.APP_URL ?? ''}/fractions/${assoc.fractionId}`,
    })
    sendEmail({ to: userData.email, ...email }).catch(() => {})
  }

  return updated
}

export async function rejectAssociation(orgId: string, associationId: string, adminUserId: string) {
  const [assoc] = await db
    .select()
    .from(userFractions)
    .where(and(eq(userFractions.id, associationId), eq(userFractions.orgId, orgId)))
    .limit(1)

  if (!assoc) throw new Error('Associação não encontrada.')
  if (assoc.status !== 'pending') throw new Error('Associação não está pendente.')

  const [updated] = await db
    .update(userFractions)
    .set({ status: 'rejected', approvedBy: adminUserId, updatedAt: new Date() })
    .where(eq(userFractions.id, associationId))
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'association.rejected',
    entityType: 'user_fraction',
    entityId: associationId,
    metadata: { userId: assoc.userId, fractionId: assoc.fractionId },
  })

  // Notify the user
  const [fraction] = await db
    .select({ label: fractions.label })
    .from(fractions)
    .where(eq(fractions.id, assoc.fractionId))
    .limit(1)
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  const [userData] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, assoc.userId))
    .limit(1)

  if (fraction && org && userData) {
    const fractionLabel = fraction.label
    await createNotification({
      orgId,
      userId: assoc.userId,
      type: 'association_rejected',
      title: `Associação rejeitada — ${fractionLabel}`,
      message: `A sua associação à fração ${fractionLabel} foi rejeitada.`,
      metadata: { fractionId: assoc.fractionId },
    })

    const email = associationRejectedEmail({
      userName: userData.name,
      fractionLabel,
      orgName: org.name,
    })
    sendEmail({ to: userData.email, ...email }).catch(() => {})
  }

  return updated
}

export async function getUserAssociatedFractionIds(orgId: string, userId: string) {
  const rows = await db
    .select({ fractionId: userFractions.fractionId, status: userFractions.status })
    .from(userFractions)
    .where(and(eq(userFractions.orgId, orgId), eq(userFractions.userId, userId)))

  const map = new Map<string, string>()
  for (const row of rows) {
    // Keep the "strongest" status: approved > pending > rejected
    const current = map.get(row.fractionId)
    if (
      !current ||
      row.status === 'approved' ||
      (row.status === 'pending' && current === 'rejected')
    ) {
      map.set(row.fractionId, row.status)
    }
  }
  return map
}

export async function listPendingAssociations(orgId: string) {
  return db
    .select({
      id: userFractions.id,
      userId: userFractions.userId,
      fractionId: userFractions.fractionId,
      role: userFractions.role,
      status: userFractions.status,
      createdAt: userFractions.createdAt,
      userName: user.name,
      userEmail: user.email,
      fractionLabel: fractions.label,
    })
    .from(userFractions)
    .innerJoin(user, eq(user.id, userFractions.userId))
    .innerJoin(fractions, eq(fractions.id, userFractions.fractionId))
    .where(and(eq(userFractions.orgId, orgId), eq(userFractions.status, 'pending')))
    .orderBy(userFractions.createdAt)
}

export async function listFractionMembers(orgId: string, fractionId: string) {
  return db
    .select({
      id: userFractions.id,
      userId: userFractions.userId,
      role: userFractions.role,
      status: userFractions.status,
      createdAt: userFractions.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(userFractions)
    .innerJoin(user, eq(user.id, userFractions.userId))
    .where(and(eq(userFractions.orgId, orgId), eq(userFractions.fractionId, fractionId)))
    .orderBy(userFractions.createdAt)
}
