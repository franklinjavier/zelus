import { useState, useRef, useEffect, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  AiChat02Icon,
  SentIcon,
  Ticket02Icon,
  Search01Icon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href, useNavigate, useRevalidator } from 'react-router'

import type { Route } from './+types/index'
import { userContext } from '~/lib/auth/context'
import { MessageBubble, LoadingBubble } from './_modules/chat-bubbles'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Assistente — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)
  return { userName: user.name }
}

const suggestions = [
  {
    label: 'Reportar um problema',
    prompt: 'Quero reportar um problema no edifício.',
    icon: Ticket02Icon,
  },
  {
    label: 'Ver as minhas ocorrências',
    prompt: 'Mostra-me as minhas ocorrências recentes.',
    icon: Search01Icon,
  },
  {
    label: 'Consultar regulamento',
    prompt: 'Tenho uma dúvida sobre o regulamento do condomínio.',
    icon: BookOpen01Icon,
  },
]

export default function AssistantIndexPage({ loaderData }: Route.ComponentProps) {
  const { userName } = loaderData
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const redirectedRef = useRef(false)
  const conversationIdRef = useRef<string | null>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: href('/api/chat'),
        fetch: async (url, init) => {
          const response = await fetch(url, init)
          const convId = response.headers.get('X-Conversation-Id')
          if (convId) {
            conversationIdRef.current = convId
          }
          return response
        },
      }),
    [],
  )

  const { messages, sendMessage, status } = useChat({
    id: 'zelus-new-chat',
    transport,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Navigate to conversation page once we have an ID and streaming is done
  useEffect(() => {
    if (
      conversationIdRef.current &&
      status === 'ready' &&
      messages.length > 0 &&
      !redirectedRef.current
    ) {
      redirectedRef.current = true
      revalidator.revalidate()
      navigate(href('/assistant/:id', { id: conversationIdRef.current }), { replace: true })
    }
  }, [status, messages.length, navigate, revalidator])

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

  function handleSuggestion(prompt: string) {
    sendMessage({ text: prompt })
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState userName={userName} onSuggestion={handleSuggestion} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-6">
            {messages.map((message, i) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={
                  status === 'streaming' &&
                  message.role === 'assistant' &&
                  i === messages.length - 1
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
        )}
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
            className="bg-foreground text-background flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30"
          >
            <HugeiconsIcon icon={SentIcon} size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}

function EmptyState({
  userName,
  onSuggestion,
}: {
  userName: string
  onSuggestion: (prompt: string) => void
}) {
  const firstName = userName.split(' ')[0]

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="bg-primary/10 mb-4 flex size-14 items-center justify-center rounded-2xl">
        <HugeiconsIcon icon={AiChat02Icon} size={28} className="text-primary" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">Olá, {firstName}!</h1>
      <p className="text-muted-foreground mt-1 text-center text-sm">
        Sou o assistente do condomínio. Como posso ajudar?
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSuggestion(s.prompt)}
            className="bg-card hover:bg-primary/[0.03] hover:ring-primary/20 ring-foreground/10 flex items-center gap-2 rounded-4xl px-4 py-2 text-sm font-medium ring-1 transition-all"
          >
            <HugeiconsIcon icon={s.icon} size={16} strokeWidth={2} className="text-primary" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
