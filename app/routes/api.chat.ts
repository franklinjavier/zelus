import { streamText, generateText, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

import type { Route } from './+types/api.chat'
import { orgMemberMiddleware } from '~/lib/auth/middleware'
import { orgContext, userContext } from '~/lib/auth/context'
import { waitUntilContext } from '~/lib/vercel/context'
import {
  createConversation,
  ownsConversation,
  saveMessage,
  getRecentMessages,
  updateConversationTitle,
} from '~/lib/services/conversations'
import { eq, or, and } from 'drizzle-orm'
import { listCategories } from '~/lib/services/categories'
import { db } from '~/lib/db'
import { member, user as userTable } from '~/lib/db/schema'
import { getAssistantTools } from '~/lib/ai/tools'
import { buildSystemPrompt } from '~/lib/ai/system-prompt'

export const middleware: Route.MiddlewareFunction[] = [orgMemberMiddleware]

export async function action({ request, context }: Route.ActionArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  const body = await request.json()
  const messages = body?.messages
  const conversationId = body?.conversationId

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Invalid messages', { status: 400 })
  }

  // Resolve or create conversation
  let convId: string

  if (conversationId) {
    const owned = await ownsConversation(conversationId, user.id)
    if (!owned) {
      return new Response('Conversation not found', { status: 404 })
    }
    convId = conversationId
  } else {
    const conv = await createConversation(org.orgId, user.id)
    convId = conv.id

    // Generate summarized title in background from user's first message
    const userText = extractMessageText(messages[messages.length - 1])
    if (userText) {
      const backgroundProcess = context.get(waitUntilContext)
      backgroundProcess(generateConversationTitle(convId, userText))
    }
  }

  // Save the incoming user message (v6: parts array, not content string)
  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user') {
    const text = extractMessageText(lastMessage)
    if (text) {
      await saveMessage(convId, 'user', text)
    }
  }

  // Load conversation history, categories, and admins in parallel
  const [history, categories, admins] = await Promise.all([
    getRecentMessages(convId, 20),
    listCategories(),
    db
      .select({ name: userTable.name, email: userTable.email })
      .from(member)
      .innerJoin(userTable, eq(userTable.id, member.userId))
      .where(
        and(
          eq(member.organizationId, org.orgId),
          or(eq(member.role, 'owner'), eq(member.role, 'admin')),
        ),
      ),
  ])

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: buildSystemPrompt({
      orgName: org.orgName,
      userName: user.name,
      categories: categories.map((c) => c.key),
      admins: admins.map((a) => ({ name: a.name, email: a.email })),
    }),
    messages: history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    tools: getAssistantTools(org.orgId, user.id),
    stopWhen: stepCountIs(8),
    onFinish: async ({ text, steps }) => {
      const toolResults = steps.flatMap((step) =>
        step.toolResults.map((r) => ({
          toolName: r.toolName,
          toolCallId: r.toolCallId,
          result: r.output,
        })),
      )

      if (text || toolResults.length > 0) {
        await saveMessage(
          convId,
          'assistant',
          text || '',
          toolResults.length > 0 ? toolResults : undefined,
        )
      }
    },
  })

  return result.toUIMessageStreamResponse({
    headers: {
      'X-Conversation-Id': convId,
    },
  })
}

function extractMessageText(message: {
  role?: string
  content?: string
  parts?: Array<{ type: string; text?: string }>
}): string {
  if (!message) return ''
  return (
    message.content ??
    message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('') ??
    ''
  )
}

async function generateConversationTitle(conversationId: string, userMessage: string) {
  try {
    const truncated = userMessage.slice(0, 200)
    const { text: title } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system:
        'A tua ÚNICA tarefa é gerar um título curto (máximo 6 palavras) que resuma o TEMA da mensagem do utilizador. NÃO respondas à pergunta. NÃO incluas explicações. Responde APENAS com o título, sem aspas nem pontuação final. Exemplos: "Luz da garagem avariada", "Barulho no 3º andar", "Horário de obras".',
      messages: [{ role: 'user', content: truncated }],
    })
    if (title) {
      await updateConversationTitle(conversationId, title.trim().slice(0, 100))
    }
  } catch (error) {
    console.error('[Chat] Failed to generate title:', error)
  }
}
