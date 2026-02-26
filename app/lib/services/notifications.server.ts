import { eq, and, isNull, desc, count, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { notifications } from '~/lib/db/schema'

export async function createNotification(params: {
  orgId: string
  userId: string
  type: string
  title: string
  message: string
  metadata?: Record<string, unknown>
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      orgId: params.orgId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? null,
    })
    .returning()

  return notification
}

export async function listNotifications(orgId: string, userId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.orgId, orgId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
}

export async function markAsRead(orgId: string, notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.orgId, orgId),
        eq(notifications.userId, userId),
      ),
    )
    .returning()

  return updated ?? null
}

export async function markAllAsRead(orgId: string, userId: string) {
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(notifications.orgId, orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
}

export async function getUnreadCount(orgId: string, userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.orgId, orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )

  return result?.count ?? 0
}
