import { eq, and, isNull, asc, inArray } from 'drizzle-orm'

import { db } from '~/lib/db'
import { ticketComments, ticketEvents, ticketAttachments, user } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommentItem = {
  type: 'comment'
  id: string
  userName: string
  userImage: string | null
  content: string
  createdAt: string
  attachments: {
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
  }[]
}

type StatusChangeItem = {
  type: 'status_change'
  id: string
  userName: string
  userImage: string | null
  fromStatus: string
  toStatus: string
  createdAt: string
}

type AttachmentItem = {
  type: 'attachment'
  id: string
  userName: string
  userImage: string | null
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  createdAt: string
}

export type TimelineItem = CommentItem | StatusChangeItem | AttachmentItem

// ---------------------------------------------------------------------------
// addComment
// ---------------------------------------------------------------------------

export async function addComment(orgId: string, ticketId: string, content: string, userId: string) {
  const [comment] = await db
    .insert(ticketComments)
    .values({
      orgId,
      ticketId,
      userId,
      content,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'ticket.comment_added',
    entityType: 'ticket_comment',
    entityId: comment.id,
    metadata: { ticketId },
  })

  return comment
}

// ---------------------------------------------------------------------------
// getTicketTimeline
// ---------------------------------------------------------------------------

export async function getTicketTimeline(orgId: string, ticketId: string): Promise<TimelineItem[]> {
  // 1. Comments
  const comments = await db
    .select({
      id: ticketComments.id,
      userName: user.name,
      userImage: user.image,
      content: ticketComments.content,
      createdAt: ticketComments.createdAt,
    })
    .from(ticketComments)
    .innerJoin(user, eq(user.id, ticketComments.userId))
    .where(and(eq(ticketComments.orgId, orgId), eq(ticketComments.ticketId, ticketId)))
    .orderBy(asc(ticketComments.createdAt))

  // Fetch attachments for those comments
  const commentIds = comments.map((c) => c.id)
  const commentAttachments =
    commentIds.length > 0
      ? await db
          .select({
            id: ticketAttachments.id,
            commentId: ticketAttachments.commentId,
            fileName: ticketAttachments.fileName,
            fileUrl: ticketAttachments.fileUrl,
            fileSize: ticketAttachments.fileSize,
            mimeType: ticketAttachments.mimeType,
          })
          .from(ticketAttachments)
          .where(inArray(ticketAttachments.commentId, commentIds))
      : []

  const attachmentsByComment = new Map<
    string,
    { id: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string }[]
  >()
  for (const a of commentAttachments) {
    const list = attachmentsByComment.get(a.commentId!) ?? []
    list.push({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
    })
    attachmentsByComment.set(a.commentId!, list)
  }

  const commentItems: CommentItem[] = comments.map((c) => ({
    type: 'comment' as const,
    id: c.id,
    userName: c.userName,
    userImage: c.userImage,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    attachments: attachmentsByComment.get(c.id) ?? [],
  }))

  // 2. Status change events
  const events = await db
    .select({
      id: ticketEvents.id,
      userName: user.name,
      userImage: user.image,
      fromStatus: ticketEvents.fromStatus,
      toStatus: ticketEvents.toStatus,
      createdAt: ticketEvents.createdAt,
    })
    .from(ticketEvents)
    .innerJoin(user, eq(user.id, ticketEvents.userId))
    .where(and(eq(ticketEvents.orgId, orgId), eq(ticketEvents.ticketId, ticketId)))
    .orderBy(asc(ticketEvents.createdAt))

  const eventItems: StatusChangeItem[] = events.map((e) => ({
    type: 'status_change' as const,
    id: e.id,
    userName: e.userName,
    userImage: e.userImage,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    createdAt: e.createdAt.toISOString(),
  }))

  // 3. Standalone attachments (not tied to a comment)
  const standaloneAttachments = await db
    .select({
      id: ticketAttachments.id,
      userName: user.name,
      userImage: user.image,
      fileName: ticketAttachments.fileName,
      fileUrl: ticketAttachments.fileUrl,
      fileSize: ticketAttachments.fileSize,
      mimeType: ticketAttachments.mimeType,
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

  const attachmentItems: AttachmentItem[] = standaloneAttachments.map((a) => ({
    type: 'attachment' as const,
    id: a.id,
    userName: a.userName,
    userImage: a.userImage,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    createdAt: a.createdAt.toISOString(),
  }))

  // Merge and sort ascending by createdAt
  const timeline: TimelineItem[] = [...commentItems, ...eventItems, ...attachmentItems].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  )

  return timeline
}
