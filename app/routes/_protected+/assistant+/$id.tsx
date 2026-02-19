import { useChat } from '@ai-sdk/react'
import { ArrowUp02Icon, CircleArrowUp02Icon, SentIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { data, Form, href, redirect, useRevalidator } from 'react-router'

import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { userContext } from '~/lib/auth/context'
import { deleteConversation, loadConversation } from '~/lib/services/conversations'
import type { Route } from './+types/$id'
import { LoadingBubble, MessageBubble } from './_modules/chat-bubbles'

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.conversation?.title || 'Conversa'
  return [{ title: `${title} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext)

  const result = await loadConversation(params.id, user.id)
  if (!result) {
    throw data(null, { status: 404 })
  }

  return {
    conversation: result.conversation,
    initialMessages: result.messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    })),
  }
}

export async function action({ params, context }: Route.ActionArgs) {
  const user = context.get(userContext)

  const deleted = await deleteConversation(params.id, user.id)
  if (!deleted) {
    throw data(null, { status: 404 })
  }

  throw redirect(href('/assistant'))
}

export default function ConversationPage({ loaderData }: Route.ComponentProps) {
  const { conversation, initialMessages } = loaderData
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const revalidator = useRevalidator()

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: href('/api/chat'),
        body: { conversationId: conversation.id },
      }),
    [conversation.id],
  )

  const { messages, sendMessage, status } = useChat({
    id: `zelus-chat-${conversation.id}`,
    transport,
    messages: initialMessages,
    onFinish: () => {
      revalidator.revalidate()
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage({ text })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Conversation header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="truncate text-sm font-medium">{conversation.title || 'Conversa'}</h2>
        <DeleteConfirmDialog
          title="Apagar conversa?"
          description="Tem a certeza que deseja apagar esta conversa? Esta ação é irreversível."
        >
          <Form method="post">
            <AlertDialogAction type="submit" variant="destructive">
              Apagar
            </AlertDialogAction>
          </Form>
        </DeleteConfirmDialog>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-6">
          {messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={
                status === 'streaming' && message.role === 'assistant' && i === messages.length - 1
              }
              isLast={i === messages.length - 1}
              onOptionClick={!isLoading ? (option) => sendMessage({ text: option }) : undefined}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && <LoadingBubble />}
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="ring-foreground/10 focus-within:ring-foreground/20 mx-auto flex max-w-2xl items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 ring-1 transition-shadow"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva a sua mensagem..."
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-primary text-background flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-10"
          >
            <HugeiconsIcon icon={ArrowUp02Icon} size={16} strokeWidth={3} />
          </button>
        </form>
      </div>
    </div>
  )
}
