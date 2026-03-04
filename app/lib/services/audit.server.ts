import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { auditLogs, user } from '~/lib/db/schema'

export async function logAuditEvent(params: {
  orgId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.insert(auditLogs).values({
    orgId: params.orgId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata ?? null,
  })
}

export async function listAuditLogs(
  orgId: string,
  filters?: {
    entityType?: string
    action?: string
    userId?: string
  },
  limit = 50,
  offset = 0,
) {
  const conditions = [eq(auditLogs.orgId, orgId)]

  if (filters?.entityType) {
    conditions.push(eq(auditLogs.entityType, filters.entityType))
  }
  if (filters?.action) {
    conditions.push(eq(auditLogs.action, filters.action))
  }
  if (filters?.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId))
  }

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userName: user.name,
      })
      .from(auditLogs)
      .innerJoin(user, eq(auditLogs.userId, user.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...conditions)),
  ])

  return { rows, total: count }
}

export async function getAuditLogFilterOptions(orgId: string) {
  const [entityTypes, actions, users] = await Promise.all([
    db
      .selectDistinct({ value: auditLogs.entityType })
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId))
      .orderBy(auditLogs.entityType),
    db
      .selectDistinct({ value: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId))
      .orderBy(auditLogs.action),
    db
      .selectDistinct({ id: user.id, name: user.name })
      .from(auditLogs)
      .innerJoin(user, eq(auditLogs.userId, user.id))
      .where(eq(auditLogs.orgId, orgId))
      .orderBy(user.name),
  ])

  return {
    entityTypes: entityTypes.map((r) => r.value),
    actions: actions.map((r) => r.value),
    users: users.map((r) => ({ id: r.id, name: r.name })),
  }
}
