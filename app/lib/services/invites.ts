import { eq, and } from 'drizzle-orm'

import { db } from '~/lib/db'
import { invites, userFractions, fractions, member, user, organization } from '~/lib/db/schema'
import { logAuditEvent } from './audit'
import { createNotification } from './notifications'
import { sendEmail } from '~/lib/email/client'
import { orgInviteEmail } from '~/lib/email/templates/org-invite'
import { fractionInviteEmail } from '~/lib/email/templates/fraction-invite'

function generateToken(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID()
}

export async function createOrgInvite(
  orgId: string,
  email: string,
  role: 'org_admin' | 'fraction_member',
  adminUserId: string,
) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [invite] = await db
    .insert(invites)
    .values({
      orgId,
      email,
      type: 'org',
      role,
      token,
      invitedBy: adminUserId,
      expiresAt,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'invite.created',
    entityType: 'invite',
    entityId: invite.id,
    metadata: { email, type: 'org', role },
  })

  // Send invite email
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  const [inviter] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, adminUserId))
    .limit(1)

  if (org && inviter) {
    const emailData = orgInviteEmail({
      orgName: org.name,
      inviterName: inviter.name,
      inviteUrl: `${process.env.APP_URL ?? ''}/invite/${token}`,
    })
    sendEmail({ to: email, ...emailData }).catch(() => {})
  }

  return invite
}

export async function createFractionInvite(
  orgId: string,
  fractionId: string,
  email: string,
  role: 'fraction_owner_admin' | 'fraction_member',
  inviterUserId: string,
) {
  // If role is fraction_owner_admin, check uniqueness
  if (role === 'fraction_owner_admin') {
    const [existingOwner] = await db
      .select()
      .from(userFractions)
      .where(
        and(
          eq(userFractions.fractionId, fractionId),
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

  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [invite] = await db
    .insert(invites)
    .values({
      orgId,
      email,
      type: 'fraction',
      fractionId,
      role,
      token,
      invitedBy: inviterUserId,
      expiresAt,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId: inviterUserId,
    action: 'invite.created',
    entityType: 'invite',
    entityId: invite.id,
    metadata: { email, type: 'fraction', fractionId, role },
  })

  // Send invite email
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  const [fraction] = await db
    .select({ label: fractions.label })
    .from(fractions)
    .where(eq(fractions.id, fractionId))
    .limit(1)
  const [inviter] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, inviterUserId))
    .limit(1)

  if (org && fraction && inviter) {
    const emailData = fractionInviteEmail({
      orgName: org.name,
      fractionLabel: fraction.label,
      inviterName: inviter.name,
      inviteUrl: `${process.env.APP_URL ?? ''}/invite/${token}`,
    })
    sendEmail({ to: email, ...emailData }).catch(() => {})
  }

  return invite
}

export async function acceptInvite(token: string, userId: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), eq(invites.status, 'pending')))
    .limit(1)

  if (!invite) throw new Error('Convite não encontrado ou já utilizado.')
  if (invite.expiresAt < new Date()) {
    await db.update(invites).set({ status: 'expired' }).where(eq(invites.id, invite.id))
    throw new Error('Convite expirado.')
  }

  // For org invites, ensure user is org member
  if (invite.type === 'org') {
    const [existingMember] = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, invite.orgId), eq(member.userId, userId)))
      .limit(1)

    if (!existingMember) {
      // Add user as org member
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: invite.orgId,
        userId,
        role: invite.role === 'org_admin' ? 'admin' : 'member',
        createdAt: new Date(),
      })
    }
  }

  // For fraction invites, auto-approve the association
  if (invite.type === 'fraction' && invite.fractionId) {
    // Check for existing association
    const [existing] = await db
      .select()
      .from(userFractions)
      .where(
        and(
          eq(userFractions.orgId, invite.orgId),
          eq(userFractions.userId, userId),
          eq(userFractions.fractionId, invite.fractionId),
        ),
      )
      .limit(1)

    if (!existing) {
      await db.insert(userFractions).values({
        orgId: invite.orgId,
        userId,
        fractionId: invite.fractionId,
        role: invite.role as 'fraction_owner_admin' | 'fraction_member',
        status: 'approved',
        invitedBy: invite.invitedBy,
        approvedBy: invite.invitedBy,
      })
    } else if (existing.status !== 'approved') {
      await db
        .update(userFractions)
        .set({
          status: 'approved',
          role: invite.role as 'fraction_owner_admin' | 'fraction_member',
          approvedBy: invite.invitedBy,
          updatedAt: new Date(),
        })
        .where(eq(userFractions.id, existing.id))
    }

    // Also ensure user is org member
    const [existingMember] = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, invite.orgId), eq(member.userId, userId)))
      .limit(1)

    if (!existingMember) {
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: invite.orgId,
        userId,
        role: 'member',
        createdAt: new Date(),
      })
    }
  }

  // Mark invite as accepted
  await db.update(invites).set({ status: 'accepted' }).where(eq(invites.id, invite.id))

  await logAuditEvent({
    orgId: invite.orgId,
    userId,
    action: 'invite.accepted',
    entityType: 'invite',
    entityId: invite.id,
    metadata: { type: invite.type, email: invite.email },
  })

  // Notify the admin who sent the invite
  const [acceptingUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const acceptorName = acceptingUser?.name ?? invite.email

  createNotification({
    orgId: invite.orgId,
    userId: invite.invitedBy,
    type: 'invite.accepted',
    title: 'Convite aceite',
    message: `${acceptorName} aceitou o convite para ${invite.type === 'org' ? 'o condomínio' : 'a fração'}.`,
    metadata: { inviteId: invite.id, email: invite.email, type: invite.type },
  }).catch(() => {})

  return invite
}

export async function listInvites(orgId: string) {
  return db
    .select({
      id: invites.id,
      email: invites.email,
      type: invites.type,
      fractionId: invites.fractionId,
      role: invites.role,
      status: invites.status,
      token: invites.token,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
      invitedByName: user.name,
      fractionLabel: fractions.label,
    })
    .from(invites)
    .innerJoin(user, eq(user.id, invites.invitedBy))
    .leftJoin(fractions, eq(fractions.id, invites.fractionId))
    .where(eq(invites.orgId, orgId))
    .orderBy(invites.createdAt)
}

export async function getInviteByToken(token: string) {
  const [invite] = await db
    .select({
      id: invites.id,
      orgId: invites.orgId,
      email: invites.email,
      type: invites.type,
      fractionId: invites.fractionId,
      role: invites.role,
      status: invites.status,
      token: invites.token,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
      fractionLabel: fractions.label,
    })
    .from(invites)
    .leftJoin(fractions, eq(fractions.id, invites.fractionId))
    .where(eq(invites.token, token))
    .limit(1)

  return invite ?? null
}

export async function revokeInvite(orgId: string, inviteId: string, adminUserId: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.orgId, orgId), eq(invites.status, 'pending')))
    .limit(1)

  if (!invite) throw new Error('Convite não encontrado ou já não está pendente.')

  const [deleted] = await db.delete(invites).where(eq(invites.id, inviteId)).returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'invite.revoked',
    entityType: 'invite',
    entityId: inviteId,
    metadata: { email: invite.email, type: invite.type },
  })

  return deleted
}
