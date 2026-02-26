import { eq, and, count, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { suppliers, maintenanceRecords } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'

export async function createSupplier(
  orgId: string,
  data: {
    name: string
    category: string
    contactName?: string | null
    contactPhone?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    address?: string | null
    notes?: string | null
  },
  adminUserId: string,
) {
  const [supplier] = await db
    .insert(suppliers)
    .values({
      orgId,
      name: data.name,
      category: data.category,
      contactName: data.contactName ?? null,
      contactPhone: data.contactPhone ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'supplier.created',
    entityType: 'supplier',
    entityId: supplier.id,
    metadata: { name: data.name, category: data.category },
  })

  return supplier
}

export async function listSuppliers(orgId: string, filters?: { category?: string }) {
  let query = db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      category: suppliers.category,
      contactName: suppliers.contactName,
      contactPhone: suppliers.contactPhone,
      phone: suppliers.phone,
      email: suppliers.email,
      website: suppliers.website,
      address: suppliers.address,
      notes: suppliers.notes,
      createdAt: suppliers.createdAt,
    })
    .from(suppliers)
    .where(eq(suppliers.orgId, orgId))
    .orderBy(suppliers.name)
    .$dynamic()

  if (filters?.category) {
    query = query.where(and(eq(suppliers.orgId, orgId), eq(suppliers.category, filters.category)))
  }

  return query
}

export async function getSupplier(orgId: string, supplierId: string) {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.orgId, orgId)))
    .limit(1)

  return supplier ?? null
}

export async function getSupplierMaintenanceCount(orgId: string, supplierId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(and(eq(maintenanceRecords.orgId, orgId), eq(maintenanceRecords.supplierId, supplierId)))

  return result?.count ?? 0
}

export async function updateSupplier(
  orgId: string,
  supplierId: string,
  data: {
    name?: string
    category?: string
    contactName?: string | null
    contactPhone?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    address?: string | null
    notes?: string | null
  },
  adminUserId: string,
) {
  const [updated] = await db
    .update(suppliers)
    .set({ ...data, updatedAt: sql`now()` })
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'supplier.updated',
      entityType: 'supplier',
      entityId: supplierId,
      metadata: data,
    })
  }

  return updated ?? null
}

export async function deleteSupplier(orgId: string, supplierId: string, adminUserId: string) {
  const maintenanceCount = await getSupplierMaintenanceCount(orgId, supplierId)

  if (maintenanceCount > 0) {
    throw new Error('Não é possível apagar prestador com intervenções associadas.')
  }

  const [deleted] = await db
    .delete(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.orgId, orgId)))
    .returning()

  if (deleted) {
    await logAuditEvent({
      orgId,
      userId: adminUserId,
      action: 'supplier.deleted',
      entityType: 'supplier',
      entityId: supplierId,
      metadata: { name: deleted.name },
    })
  }

  return deleted ?? null
}
