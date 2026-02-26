import { and, eq, isNotNull, notInArray } from 'drizzle-orm'

import { db } from '~/lib/db'
import { fractionContacts, userFractions, member, user } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listFractionContacts(orgId: string, fractionId: string) {
  const linkedUser = {
    name: user.name,
    email: user.email,
    image: user.image,
  }

  return db
    .select({
      id: fractionContacts.id,
      name: fractionContacts.name,
      nif: fractionContacts.nif,
      mobile: fractionContacts.mobile,
      phone: fractionContacts.phone,
      email: fractionContacts.email,
      notes: fractionContacts.notes,
      userId: fractionContacts.userId,
      linkedUserName: linkedUser.name,
      linkedUserEmail: linkedUser.email,
      linkedUserImage: linkedUser.image,
    })
    .from(fractionContacts)
    .leftJoin(user, eq(user.id, fractionContacts.userId))
    .where(and(eq(fractionContacts.orgId, orgId), eq(fractionContacts.fractionId, fractionId)))
    .orderBy(fractionContacts.name)
}

export async function listLinkableOrgMembers(orgId: string, fractionId: string) {
  const linkedUserIds = (
    await db
      .select({ userId: fractionContacts.userId })
      .from(fractionContacts)
      .where(
        and(
          eq(fractionContacts.orgId, orgId),
          eq(fractionContacts.fractionId, fractionId),
          isNotNull(fractionContacts.userId),
        ),
      )
  )
    .map((r) => r.userId)
    .filter((id): id is string => id !== null)

  const query = db
    .select({
      userId: member.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      linkedUserIds.length > 0
        ? and(eq(member.organizationId, orgId), notInArray(member.userId, linkedUserIds))
        : eq(member.organizationId, orgId),
    )

  return query
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface ContactData {
  name: string
  nif?: string | null
  mobile?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
}

export async function createContact(
  orgId: string,
  fractionId: string,
  data: ContactData,
  adminUserId: string,
) {
  const [contact] = await db
    .insert(fractionContacts)
    .values({
      orgId,
      fractionId,
      name: data.name,
      nif: data.nif ?? null,
      mobile: data.mobile ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
      createdBy: adminUserId,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.created',
    entityType: 'fraction_contact',
    entityId: contact.id,
    metadata: { fractionId },
  })

  return contact
}

export async function updateContact(
  orgId: string,
  contactId: string,
  data: ContactData,
  adminUserId: string,
) {
  const [contact] = await db
    .update(fractionContacts)
    .set({
      name: data.name,
      nif: data.nif ?? null,
      mobile: data.mobile ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .returning()

  if (!contact) throw new Error('Contacto não encontrado.')

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.updated',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: {},
  })

  return contact
}

export async function deleteContact(orgId: string, contactId: string, adminUserId: string) {
  const [contact] = await db
    .delete(fractionContacts)
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .returning()

  if (!contact) throw new Error('Contacto não encontrado.')

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.deleted',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: { name: contact.name },
  })

  return contact
}

export async function linkContactToUser(
  orgId: string,
  contactId: string,
  userId: string,
  adminUserId: string,
) {
  const [contact] = await db
    .select()
    .from(fractionContacts)
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .limit(1)

  if (!contact) throw new Error('Contacto não encontrado.')
  if (contact.userId) throw new Error('Contacto já associado a uma conta.')

  const [orgMember] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .limit(1)

  if (!orgMember) throw new Error('Utilizador não é membro desta organização.')

  await db
    .update(fractionContacts)
    .set({ userId, updatedAt: new Date() })
    .where(eq(fractionContacts.id, contactId))

  // Create or update the user_fractions association
  const [existingAssoc] = await db
    .select()
    .from(userFractions)
    .where(
      and(
        eq(userFractions.orgId, orgId),
        eq(userFractions.fractionId, contact.fractionId),
        eq(userFractions.userId, userId),
      ),
    )
    .limit(1)

  if (existingAssoc) {
    if (existingAssoc.status !== 'approved') {
      await db
        .update(userFractions)
        .set({ status: 'approved', approvedBy: adminUserId, updatedAt: new Date() })
        .where(eq(userFractions.id, existingAssoc.id))
    }
  } else {
    await db.insert(userFractions).values({
      orgId,
      userId,
      fractionId: contact.fractionId,
      role: 'fraction_member',
      status: 'approved',
      approvedBy: adminUserId,
    })
  }

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.linked',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: { linkedUserId: userId },
  })
}

export async function unlinkContact(orgId: string, contactId: string, adminUserId: string) {
  const [contact] = await db
    .update(fractionContacts)
    .set({ userId: null, updatedAt: new Date() })
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .returning()

  if (!contact) throw new Error('Contacto não encontrado.')

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.unlinked',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: {},
  })

  return contact
}
