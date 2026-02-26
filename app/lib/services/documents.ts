import { eq, and, desc, sql } from 'drizzle-orm'
import { del } from '@vercel/blob'

import { db } from '~/lib/db'
import { documents, documentChunks } from '~/lib/db/schema'
import { logAuditEvent } from './audit'

export async function createDocument(
  orgId: string,
  data: {
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
  },
  userId: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      uploadedBy: userId,
      type: 'file',
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.created',
    entityType: 'document',
    entityId: doc.id,
    metadata: { fileName: data.fileName },
  })

  return doc
}

export async function createArticle(
  orgId: string,
  data: { title: string; body: string },
  userId: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      uploadedBy: userId,
      type: 'article',
      title: data.title,
      body: data.body,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.created',
    entityType: 'document',
    entityId: doc.id,
    metadata: { title: data.title, type: 'article' },
  })

  return doc
}

export async function createUrlEntry(
  orgId: string,
  data: { title: string; sourceUrl: string },
  userId: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      uploadedBy: userId,
      type: 'url',
      title: data.title,
      sourceUrl: data.sourceUrl,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.created',
    entityType: 'document',
    entityId: doc.id,
    metadata: { title: data.title, type: 'url', sourceUrl: data.sourceUrl },
  })

  return doc
}

export async function listDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt))
}

export async function listReadyDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.status, 'ready')))
    .orderBy(desc(documents.createdAt))
}

export async function getKnowledgeBaseHighlights(orgId: string, limit = 6) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.status, 'ready')))
    .orderBy(
      sql`CASE WHEN ${documents.pinnedAt} IS NOT NULL THEN 0 ELSE 1 END`,
      desc(documents.pinnedAt),
      desc(documents.createdAt),
    )
    .limit(limit)
}

export async function pinDocument(orgId: string, documentId: string, pin: boolean) {
  await db
    .update(documents)
    .set({ pinnedAt: pin ? new Date() : null })
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
}

export async function deleteDocument(orgId: string, documentId: string, userId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) throw new Error('Documento não encontrado.')

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))

  if (doc.fileUrl) {
    await del(doc.fileUrl).catch(() => {})
  }

  const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.deleted',
    entityType: 'document',
    entityId: documentId,
    metadata: { title: doc.title ?? doc.fileName, type: doc.type },
  })

  return deleted
}

export async function updateDocumentStatus(
  documentId: string,
  status: 'processing' | 'ready' | 'error',
) {
  await db.update(documents).set({ status }).where(eq(documents.id, documentId))
}

export async function resetDocumentForReprocessing(orgId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) throw new Error('Documento não encontrado.')

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))
  await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, documentId))

  return doc
}

export async function getDocument(orgId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)
  return doc ?? null
}

export async function getDocumentChunks(documentId: string) {
  return db
    .select({ content: documentChunks.content, chunkIndex: documentChunks.chunkIndex })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(documentChunks.chunkIndex)
}
