import { eq, and, desc, sql, inArray } from 'drizzle-orm'

import { db } from '~/lib/db'
import { conversations, conversationMessages } from '~/lib/db/schema'

/**
 * List all conversations for a user in an org, ordered by most recent first.
 * Includes a preview of the last message (two queries, no N+1).
 */
export async function listConversations(orgId: string, userId: string) {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.userId, userId)))
    .orderBy(desc(sql`COALESCE(${conversations.updatedAt}, ${conversations.createdAt})`))

  if (rows.length === 0) return []

  // Batch fetch last message for all conversations using DISTINCT ON
  const convIds = rows.map((r) => r.id)
  const previews = await db
    .selectDistinctOn([conversationMessages.conversationId], {
      conversationId: conversationMessages.conversationId,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(inArray(conversationMessages.conversationId, convIds))
    .orderBy(conversationMessages.conversationId, desc(conversationMessages.createdAt))

  const previewMap = new Map(previews.map((p) => [p.conversationId, p.content]))

  return rows.map((r) => ({
    ...r,
    lastMessage: previewMap.get(r.id)?.slice(0, 100) ?? null,
  }))
}

/**
 * Create a new conversation for a user in an org.
 */
export async function createConversation(orgId: string, userId: string, title?: string) {
  const [created] = await db
    .insert(conversations)
    .values({ orgId, userId, title: title ?? null })
    .returning()

  return created
}

/**
 * Lightweight ownership check — returns true if the conversation belongs to the user.
 */
export async function ownsConversation(conversationId: string, userId: string) {
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  return !!conv
}

/**
 * Delete a conversation. Verifies ownership before deleting.
 */
export async function deleteConversation(conversationId: string, userId: string) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (!conv) return false

  await db.delete(conversations).where(eq(conversations.id, conversationId))
  return true
}

/**
 * Load a conversation by ID with recent messages. Verifies ownership.
 */
export async function loadConversation(conversationId: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (!conversation) return null

  const messages = await getRecentMessages(conversation.id, 50)

  return { conversation, messages }
}

/**
 * Fetch recent messages for a conversation, ordered oldest-first for Claude context.
 * Capped at `limit` messages for token control.
 */
export async function getRecentMessages(conversationId: string, limit = 20) {
  const rows = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit)

  // Reverse to oldest-first for Claude context
  return rows.reverse()
}

/**
 * Save a message to the conversation.
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: unknown,
) {
  const [msg] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    })
    .returning()

  // Touch conversation updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))

  return msg
}

/**
 * Update conversation title.
 */
export async function updateConversationTitle(conversationId: string, title: string) {
  await db.update(conversations).set({ title }).where(eq(conversations.id, conversationId))
}
