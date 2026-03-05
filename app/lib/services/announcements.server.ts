import { eq, and, isNull, desc } from 'drizzle-orm'

import { db } from '~/lib/db'
import { announcements, member, user } from '~/lib/db/schema'
import { getNextOccurrence, type Recurrence } from '~/lib/announcements/recurrence'
import { logAuditEvent } from './audit.server'
import { createNotification } from './notifications.server'
import { sendEmail } from '~/lib/email/client'
import { announcementEmail } from '~/lib/email/templates/announcement'

export async function createAnnouncement(
  orgId: string,
  data: {
    title: string
    description: string
    eventDate: Date
    recurrence?: Recurrence | null
  },
  userId: string,
) {
  const [announcement] = await db
    .insert(announcements)
    .values({
      orgId,
      title: data.title,
      description: data.description,
      eventDate: data.eventDate,
      recurrence: data.recurrence ?? null,
      createdById: userId,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'announcement.created',
    entityType: 'announcement',
    entityId: announcement.id,
    metadata: { title: data.title },
  })

  return announcement
}

export async function broadcastAnnouncement(
  orgId: string,
  orgName: string,
  announcement: { id: string; title: string; description: string; eventDate: Date },
  creatorId: string,
) {
  const members = await db
    .select({ userId: member.userId, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId))

  const truncatedDesc =
    announcement.description.length > 200
      ? announcement.description.slice(0, 200) + '...'
      : announcement.description

  const email = announcementEmail({
    orgName,
    title: announcement.title,
    description: announcement.description,
    eventDate: announcement.eventDate,
  })

  await Promise.allSettled(
    members.map(async (m) => {
      await createNotification({
        orgId,
        userId: m.userId,
        type: 'announcement',
        title: announcement.title,
        message: truncatedDesc,
        metadata: { announcementId: announcement.id },
      })

      await sendEmail({
        to: m.email,
        subject: email.subject,
        html: email.html,
      })
    }),
  )

  await logAuditEvent({
    orgId,
    userId: creatorId,
    action: 'announcement.broadcast',
    entityType: 'announcement',
    entityId: announcement.id,
    metadata: { recipientCount: members.length },
  })
}

export async function updateAnnouncement(
  orgId: string,
  id: string,
  data: {
    title?: string
    description?: string
    eventDate?: Date
    recurrence?: Recurrence | null
  },
  userId: string,
) {
  const [updated] = await db
    .update(announcements)
    .set(data)
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.updated',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function archiveAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ archivedAt: new Date() })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.archived',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function unarchiveAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ archivedAt: null })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.unarchived',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function pauseAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ pausedAt: new Date() })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.paused',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function resumeAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ pausedAt: null })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.resumed',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function deleteAnnouncement(orgId: string, id: string, userId: string) {
  const [deleted] = await db
    .delete(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (deleted) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.deleted',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: deleted.title },
    })
  }

  return deleted ?? null
}

export async function getAnnouncement(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))

  return row ?? null
}

export async function listAnnouncementsAdmin(orgId: string) {
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.orgId, orgId))
    .orderBy(desc(announcements.createdAt))
}

export async function getActiveAnnouncements(orgId: string, limit = 5) {
  const now = new Date()

  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.orgId, orgId),
        isNull(announcements.archivedAt),
        isNull(announcements.pausedAt),
      ),
    )

  const withNext = rows
    .map((row) => {
      const nextOccurrence = getNextOccurrence(
        row.eventDate,
        row.recurrence as Recurrence | null,
        now,
      )
      return nextOccurrence ? { ...row, nextOccurrence } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime())
    .slice(0, limit)

  return withNext
}
