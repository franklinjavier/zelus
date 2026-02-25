import { eq, and, desc } from 'drizzle-orm'
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

export async function listDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt))
}

export async function deleteDocument(orgId: string, documentId: string, userId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) throw new Error('Documento não encontrado.')

  // Delete chunks first (cascade should handle this, but be explicit)
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))

  // Delete from Vercel Blob
  await del(doc.fileUrl).catch(() => {})

  // Delete the document record
  const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.deleted',
    entityType: 'document',
    entityId: documentId,
    metadata: { fileName: doc.fileName },
  })

  return deleted
}

export async function updateDocumentStatus(
  documentId: string,
  status: 'processing' | 'ready' | 'error',
) {
  await db.update(documents).set({ status }).where(eq(documents.id, documentId))
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
