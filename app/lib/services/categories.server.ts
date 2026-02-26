import { eq, count, or } from 'drizzle-orm'

import { db } from '~/lib/db'
import { categories, tickets, suppliers } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'

export async function listCategories() {
  return db.select().from(categories).orderBy(categories.key)
}

export async function createCategory(key: string, userId: string, orgId: string) {
  const [category] = await db.insert(categories).values({ key }).onConflictDoNothing().returning()

  if (category) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'category.created',
      entityType: 'category',
      entityId: key,
      metadata: { key },
    })
  }

  return category ?? null
}

export async function deleteCategory(key: string, userId: string, orgId: string) {
  const [used] = await db.select({ count: count() }).from(tickets).where(eq(tickets.category, key))

  const [usedBySuppliers] = await db
    .select({ count: count() })
    .from(suppliers)
    .where(eq(suppliers.category, key))

  const totalUsed = (used?.count ?? 0) + (usedBySuppliers?.count ?? 0)

  if (totalUsed > 0) {
    throw new Error(
      'Categoria em uso por ocorrências ou prestadores. Remova a categoria antes de apagar.',
    )
  }

  const [deleted] = await db.delete(categories).where(eq(categories.key, key)).returning()

  if (deleted) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'category.deleted',
      entityType: 'category',
      entityId: key,
      metadata: { key },
    })
  }

  return deleted ?? null
}
