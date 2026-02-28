import { eq, and, or, inArray, count, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { userFractions, fractions, user, organization, member } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'
import { createNotification } from './notifications.server'
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

  // Notify org admins
  const [fraction] = await db
    .select({ label: fractions.label })
    .from(fractions)
    .where(eq(fractions.id, fractionId))
    .limit(1)
  const [userData] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (fraction && userData) {
    const admins = await db
      .select({ userId: member.userId })
      .from(member)
      .where(
        and(
          eq(member.organizationId, orgId),
          or(eq(member.role, 'owner'), eq(member.role, 'admin')),
        ),
      )

    const fractionLabel = fraction.label
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          orgId,
          userId: admin.userId,
          type: 'association_requested',
          title: `Nova associação pendente — ${fractionLabel}`,
          message: `${userData.name} solicitou associação à fração ${fractionLabel}.`,
          metadata: { fractionId },
        }),
      ),
    )
  }

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

export async function updateMemberRole(
  orgId: string,
  associationId: string,
  role: 'fraction_owner_admin' | 'fraction_member',
  adminUserId: string,
) {
  const [assoc] = await db
    .select()
    .from(userFractions)
    .where(and(eq(userFractions.id, associationId), eq(userFractions.orgId, orgId)))
    .limit(1)

  if (!assoc) throw new Error('Associação não encontrada.')
  if (assoc.status !== 'approved') throw new Error('Associação não está aprovada.')

  if (role === 'fraction_owner_admin') {
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

    if (existingOwner && existingOwner.id !== associationId) {
      throw new Error('Já existe um administrador para esta fração.')
    }
  }

  const [updated] = await db
    .update(userFractions)
    .set({ role, updatedAt: new Date() })
    .where(eq(userFractions.id, associationId))
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'association.role_changed',
    entityType: 'user_fraction',
    entityId: associationId,
    metadata: { userId: assoc.userId, fractionId: assoc.fractionId, role },
  })

  return updated
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
      userImage: user.image,
    })
    .from(userFractions)
    .innerJoin(user, eq(user.id, userFractions.userId))
    .where(and(eq(userFractions.orgId, orgId), eq(userFractions.fractionId, fractionId)))
    .orderBy(userFractions.createdAt)
}

export async function removeAssociation(orgId: string, associationId: string, adminUserId: string) {
  const [assoc] = await db
    .select()
    .from(userFractions)
    .where(and(eq(userFractions.id, associationId), eq(userFractions.orgId, orgId)))
    .limit(1)

  if (!assoc) throw new Error('Associação não encontrada.')

  await db.delete(userFractions).where(eq(userFractions.id, associationId))

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'association.removed',
    entityType: 'user_fraction',
    entityId: associationId,
    metadata: { userId: assoc.userId, fractionId: assoc.fractionId },
  })

  const [fraction] = await db
    .select({ label: fractions.label })
    .from(fractions)
    .where(eq(fractions.id, assoc.fractionId))
    .limit(1)

  if (fraction) {
    await createNotification({
      orgId,
      userId: assoc.userId,
      type: 'association_removed',
      title: `Associação removida — ${fraction.label}`,
      message: `A sua associação à fração ${fraction.label} foi removida por um administrador.`,
      metadata: { fractionId: assoc.fractionId },
    })
  }

  return assoc
}

export async function listOrgMembers(orgId: string) {
  const members = await db
    .select({
      memberId: member.id,
      userId: member.userId,
      orgRole: member.role,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))

  const fractionCounts = await db
    .select({
      userId: userFractions.userId,
      fractionCount: count(userFractions.id),
    })
    .from(userFractions)
    .where(and(eq(userFractions.orgId, orgId), eq(userFractions.status, 'approved')))
    .groupBy(userFractions.userId)

  const countMap = new Map(fractionCounts.map((r) => [r.userId, Number(r.fractionCount)]))

  return members.map((m) => ({
    ...m,
    fractionCount: countMap.get(m.userId) ?? 0,
  }))
}

export async function updateOrgMemberRole(
  orgId: string,
  memberId: string,
  role: 'admin' | 'member',
  adminUserId: string,
) {
  const [memberRow] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)))
    .limit(1)

  if (!memberRow) throw new Error('Membro não encontrado.')
  if (memberRow.role === 'owner') throw new Error('Não é possível alterar o papel do proprietário.')

  const [updated] = await db.update(member).set({ role }).where(eq(member.id, memberId)).returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'member.role_changed',
    entityType: 'member',
    entityId: memberId,
    metadata: { targetUserId: memberRow.userId, role },
  })

  return updated
}

export async function bulkAssignUsersToFraction(
  orgId: string,
  fractionId: string,
  userIds: string[],
  adminUserId: string,
) {
  if (userIds.length === 0) return { created: 0, skipped: 0 }

  const existing = await db
    .select({ userId: userFractions.userId, status: userFractions.status })
    .from(userFractions)
    .where(
      and(
        eq(userFractions.orgId, orgId),
        eq(userFractions.fractionId, fractionId),
        inArray(userFractions.userId, userIds),
        or(eq(userFractions.status, 'approved'), eq(userFractions.status, 'pending')),
      ),
    )

  const skipSet = new Set(existing.map((e) => e.userId))
  const toInsert = userIds.filter((id) => !skipSet.has(id))

  if (toInsert.length > 0) {
    await db.insert(userFractions).values(
      toInsert.map((userId) => ({
        orgId,
        userId,
        fractionId,
        role: 'fraction_member' as const,
        status: 'approved' as const,
        approvedBy: adminUserId,
      })),
    )

    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'association.bulk_assigned',
      entityType: 'fraction',
      entityId: fractionId,
      metadata: { userIds: toInsert, count: toInsert.length },
    })

    const [fraction] = await db
      .select({ label: fractions.label })
      .from(fractions)
      .where(eq(fractions.id, fractionId))
      .limit(1)

    if (fraction) {
      await Promise.all(
        toInsert.map((userId) =>
          createNotification({
            orgId,
            userId,
            type: 'association_approved',
            title: `Associação à fração ${fraction.label}`,
            message: `Foi associado à fração ${fraction.label} por um administrador.`,
            metadata: { fractionId },
          }),
        ),
      )
    }
  }

  return { created: toInsert.length, skipped: skipSet.size }
}

export async function bulkAssignFractionsToUser(
  orgId: string,
  userId: string,
  fractionIds: string[],
  adminUserId: string,
) {
  if (fractionIds.length === 0) return { created: 0, skipped: 0 }

  const existing = await db
    .select({ fractionId: userFractions.fractionId, status: userFractions.status })
    .from(userFractions)
    .where(
      and(
        eq(userFractions.orgId, orgId),
        eq(userFractions.userId, userId),
        inArray(userFractions.fractionId, fractionIds),
        or(eq(userFractions.status, 'approved'), eq(userFractions.status, 'pending')),
      ),
    )

  const skipSet = new Set(existing.map((e) => e.fractionId))
  const toInsert = fractionIds.filter((id) => !skipSet.has(id))

  if (toInsert.length > 0) {
    await db.insert(userFractions).values(
      toInsert.map((fractionId) => ({
        orgId,
        userId,
        fractionId,
        role: 'fraction_member' as const,
        status: 'approved' as const,
        approvedBy: adminUserId,
      })),
    )

    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'association.bulk_assigned',
      entityType: 'user',
      entityId: userId,
      metadata: { fractionIds: toInsert, count: toInsert.length },
    })

    const fractionLabels = await db
      .select({ label: fractions.label })
      .from(fractions)
      .where(inArray(fractions.id, toInsert))

    const names = fractionLabels.map((f) => f.label).join(', ')
    await createNotification({
      orgId,
      userId,
      type: 'association_approved',
      title: `Associação a ${toInsert.length} ${toInsert.length === 1 ? 'fração' : 'frações'}`,
      message: `Foi associado às frações: ${names}.`,
      metadata: { fractionIds: toInsert },
    })
  }

  return { created: toInsert.length, skipped: skipSet.size }
}
