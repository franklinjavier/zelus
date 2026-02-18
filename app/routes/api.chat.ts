import { streamText, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

import type { Route } from './+types/api.chat'
import { orgMemberMiddleware } from '~/lib/auth/middleware'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  getOrCreateConversation,
  saveMessage,
  getRecentMessages,
} from '~/lib/services/conversations'
import { getAssistantTools } from '~/lib/ai/tools'
import { buildSystemPrompt } from '~/lib/ai/system-prompt'

export const middleware: Route.MiddlewareFunction[] = [orgMemberMiddleware]

export async function action({ request, context }: Route.ActionArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  const { messages } = await request.json()

  // Get or create the single conversation for this user+org
  const conversation = await getOrCreateConversation(org.orgId, user.id)

  // Save the incoming user message
  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user') {
    await saveMessage(conversation.id, 'user', lastMessage.content)
  }

  // Load conversation history from DB (capped at 20 for token control)
  const history = await getRecentMessages(conversation.id, 20)

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: buildSystemPrompt(org.orgName, user.name),
    messages: history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    tools: getAssistantTools(org.orgId, user.id),
    stopWhen: stepCountIs(5),
    onFinish: async ({ text }) => {
      if (text) {
        await saveMessage(conversation.id, 'assistant', text)
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
