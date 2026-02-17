import { eq, and, asc, isNull } from 'drizzle-orm'
import { del } from '@vercel/blob'

import { db } from '~/lib/db'
import { ticketAttachments, user } from '~/lib/db/schema'
import { logAuditEvent } from './audit'

export async function listTicketAttachments(orgId: string, ticketId: string) {
  return db
    .select({
      id: ticketAttachments.id,
      fileName: ticketAttachments.fileName,
      fileUrl: ticketAttachments.fileUrl,
      fileSize: ticketAttachments.fileSize,
      mimeType: ticketAttachments.mimeType,
      uploadedBy: ticketAttachments.uploadedBy,
      uploaderName: user.name,
      createdAt: ticketAttachments.createdAt,
    })
    .from(ticketAttachments)
    .innerJoin(user, eq(user.id, ticketAttachments.uploadedBy))
    .where(
      and(
        eq(ticketAttachments.orgId, orgId),
        eq(ticketAttachments.ticketId, ticketId),
        isNull(ticketAttachments.commentId),
      ),
    )
    .orderBy(asc(ticketAttachments.createdAt))
}

export async function createAttachment(
  orgId: string,
  data: {
    ticketId: string
    commentId?: string | null
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
  },
  userId: string,
) {
  const [attachment] = await db
    .insert(ticketAttachments)
    .values({
      orgId,
      ticketId: data.ticketId,
      commentId: data.commentId ?? null,
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
    action: 'ticket.attachment_uploaded',
    entityType: 'ticket_attachment',
    entityId: attachment.id,
    metadata: { ticketId: data.ticketId, fileName: data.fileName },
  })

  return attachment
}

export async function deleteAttachment(orgId: string, attachmentId: string, userId: string) {
  const [attachment] = await db
    .select()
    .from(ticketAttachments)
    .where(and(eq(ticketAttachments.id, attachmentId), eq(ticketAttachments.orgId, orgId)))
    .limit(1)

  if (!attachment) {
    throw new Error('Anexo não encontrado.')
  }

  if (attachment.uploadedBy !== userId) {
    throw new Error('Sem permissão para apagar este anexo.')
  }

  await del(attachment.fileUrl)

  await db
    .delete(ticketAttachments)
    .where(and(eq(ticketAttachments.id, attachmentId), eq(ticketAttachments.orgId, orgId)))

  await logAuditEvent({
    orgId,
    userId,
    action: 'ticket.attachment_deleted',
    entityType: 'ticket_attachment',
    entityId: attachmentId,
    metadata: { ticketId: attachment.ticketId, fileName: attachment.fileName },
  })
}
