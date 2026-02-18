import { eq, and, desc } from 'drizzle-orm'

import { db } from '~/lib/db'
import { conversations, conversationMessages } from '~/lib/db/schema'

/**
 * Get the user's existing conversation for this org, or create one.
 * Design: one active conversation per user per org.
 */
export async function getOrCreateConversation(orgId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.userId, userId)))
    .limit(1)

  if (existing) return existing

  const [created] = await db.insert(conversations).values({ orgId, userId }).returning()

  return created
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
 * Load full conversation with recent messages for the dashboard loader.
 */
export async function loadConversation(orgId: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.userId, userId)))
    .limit(1)

  if (!conversation) return { conversation: null, messages: [] }

  const messages = await getRecentMessages(conversation.id, 50)

  return { conversation, messages }
}
