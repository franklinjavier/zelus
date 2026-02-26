import { db } from '~/lib/db'
import { auditLogs } from '~/lib/db/schema'

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
