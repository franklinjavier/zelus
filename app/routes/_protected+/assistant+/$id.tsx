import { useChat } from '@ai-sdk/react'
import { ArrowUp02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { UIMessage } from 'ai'
import { DefaultChatTransport } from 'ai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { data, Form, href, redirect, useFetcher, useRevalidator } from 'react-router'

import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { userContext } from '~/lib/auth/context'
import {
  deleteConversation,
  loadConversation,
  updateConversationTitle,
} from '~/lib/services/conversations'
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
    initialMessages: result.messages.map((m) => {
      const parts: UIMessage['parts'] = []

      // Reconstruct tool parts from stored tool results
      const stored = m.toolCalls as Array<{
        toolName: string
        toolCallId: string
        result: unknown
      }> | null
      if (stored && Array.isArray(stored)) {
        for (const tc of stored) {
          parts.push({
            type: `tool-${tc.toolName}`,
            toolCallId: tc.toolCallId,
            state: 'output-available',
            output: tc.result,
          } as UIMessage['parts'][number])
        }
      }

      // Add text part
      if (m.content) {
        parts.push({ type: 'text' as const, text: m.content })
      }

      return {
        id: crypto.randomUUID(),
        role: m.role as 'user' | 'assistant',
        parts,
      }
    }),
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'rename') {
    const title = String(formData.get('title') || '').trim()
    if (title) {
      await updateConversationTitle(params.id, title)
    }
    return { ok: true }
  }

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Conversation header — hidden on mobile where layout header suffices */}
      <div className="hidden items-center justify-between border-b px-4 py-2 md:flex">
        <InlineTitle
          key={conversation.id}
          conversationId={conversation.id}
          initialTitle={conversation.title || 'Conversa'}
        />
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
          {isLoading &&
            (() => {
              const last = messages[messages.length - 1]
              if (!last || last.role === 'user') return true
              return !last.parts.some(
                (p) => (p.type === 'text' && p.text?.trim()) || p.type.startsWith('tool-'),
              )
            })() && <LoadingBubble />}
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
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
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
        <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-center text-xs">
          O assistente pode cometer erros. Verifique sempre informação importante.
        </p>
      </div>
    </div>
  )
}

function InlineTitle({
  conversationId,
  initialTitle,
}: {
  conversationId: string
  initialTitle: string
}) {
  const fetcher = useFetcher()
  const [editValue, setEditValue] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const editing = editValue !== null

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEditing() {
    setEditValue(initialTitle)
  }

  function save() {
    const trimmed = (editValue ?? '').trim()
    setEditValue(null)
    if (!trimmed || trimmed === initialTitle) return
    fetcher.submit(
      { intent: 'rename', title: trimmed },
      { method: 'post', action: href('/assistant/:id', { id: conversationId }) },
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="hover:bg-muted group/title flex min-w-0 items-center gap-1.5 truncate rounded px-1 py-0.5 text-sm font-medium transition-colors"
      >
        <span className="truncate">{initialTitle}</span>
        <HugeiconsIcon
          icon={PencilEdit02Icon}
          size={13}
          strokeWidth={2}
          className="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100"
        />
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save()
        if (e.key === 'Escape') setEditValue(null)
      }}
      size={editValue.length || 1}
      className="bg-muted max-w-full min-w-24 truncate rounded px-1 py-0.5 text-sm font-medium outline-none"
    />
  )
}
