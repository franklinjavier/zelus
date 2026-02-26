import { eq, and, count, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { maintenanceRecords, suppliers } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'

export async function createRecord(
  orgId: string,
  data: {
    title: string
    description: string
    supplierId?: string | null
    performedAt: Date
    cost?: string | null
  },
  adminUserId: string,
) {
  const [record] = await db
    .insert(maintenanceRecords)
    .values({
      orgId,
      title: data.title,
      description: data.description,
      supplierId: data.supplierId ?? null,
      performedAt: data.performedAt,
      cost: data.cost ?? null,
      createdBy: adminUserId,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'maintenance.created',
    entityType: 'maintenance_record',
    entityId: record.id,
    metadata: { title: data.title },
  })

  return record
}

export async function listRecords(orgId: string, filters?: { supplierId?: string }) {
  let query = db
    .select({
      id: maintenanceRecords.id,
      title: maintenanceRecords.title,
      description: maintenanceRecords.description,
      supplierId: maintenanceRecords.supplierId,
      supplierName: suppliers.name,
      performedAt: maintenanceRecords.performedAt,
      cost: maintenanceRecords.cost,
      createdAt: maintenanceRecords.createdAt,
    })
    .from(maintenanceRecords)
    .leftJoin(suppliers, eq(maintenanceRecords.supplierId, suppliers.id))
    .where(eq(maintenanceRecords.orgId, orgId))
    .orderBy(sql`${maintenanceRecords.performedAt} desc`)
    .$dynamic()

  if (filters?.supplierId) {
    query = query.where(
      and(
        eq(maintenanceRecords.orgId, orgId),
        eq(maintenanceRecords.supplierId, filters.supplierId),
      ),
    )
  }

  return query
}

export async function getRecord(orgId: string, recordId: string) {
  const [record] = await db
    .select({
      id: maintenanceRecords.id,
      title: maintenanceRecords.title,
      description: maintenanceRecords.description,
      supplierId: maintenanceRecords.supplierId,
      supplierName: suppliers.name,
      performedAt: maintenanceRecords.performedAt,
      cost: maintenanceRecords.cost,
      createdBy: maintenanceRecords.createdBy,
      createdAt: maintenanceRecords.createdAt,
      updatedAt: maintenanceRecords.updatedAt,
    })
    .from(maintenanceRecords)
    .leftJoin(suppliers, eq(maintenanceRecords.supplierId, suppliers.id))
    .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.orgId, orgId)))
    .limit(1)

  return record ?? null
}

export async function updateRecord(
  orgId: string,
  recordId: string,
  data: {
    title?: string
    description?: string
    supplierId?: string | null
    performedAt?: Date
    cost?: string | null
  },
  adminUserId: string,
) {
  const [updated] = await db
    .update(maintenanceRecords)
    .set({ ...data, updatedAt: sql`now()` })
    .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'maintenance.updated',
      entityType: 'maintenance_record',
      entityId: recordId,
      metadata: data as Record<string, unknown>,
    })
  }

  return updated ?? null
}

export async function deleteRecord(orgId: string, recordId: string, adminUserId: string) {
  const [deleted] = await db
    .delete(maintenanceRecords)
    .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.orgId, orgId)))
    .returning()

  if (deleted) {
    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'maintenance.deleted',
      entityType: 'maintenance_record',
      entityId: recordId,
      metadata: { title: deleted.title },
    })
  }

  return deleted ?? null
}

export async function countRecords(orgId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(eq(maintenanceRecords.orgId, orgId))

  return result?.count ?? 0
}
