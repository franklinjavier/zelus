import { useState, useRef, useEffect } from 'react'
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
import { href } from 'react-router'

import type { Route } from './+types/dashboard'
import { orgContext, userContext } from '~/lib/auth/context'
import { loadConversation } from '~/lib/services/conversations'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Assistente — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  const { messages } = await loadConversation(org.orgId, user.id)

  return {
    initialMessages: messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    })),
    userName: user.name,
  }
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

const transport = new DefaultChatTransport({ api: href('/api/chat') })

export default function AssistantPage({ loaderData }: Route.ComponentProps) {
  const { initialMessages, userName } = loaderData
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    id: 'zelus-chat',
    transport,
    messages: initialMessages,
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

  function handleSuggestion(prompt: string) {
    sendMessage({ text: prompt })
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState userName={userName} onSuggestion={handleSuggestion} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-4 pb-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-xl">
                  <HugeiconsIcon icon={AiChat02Icon} size={16} className="text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span
                      className="bg-foreground/30 size-2 animate-bounce rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="bg-foreground/30 size-2 animate-bounce rounded-full"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="bg-foreground/30 size-2 animate-bounce rounded-full"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-background border-t px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva a sua mensagem..."
            className="bg-muted ring-foreground/10 placeholder:text-muted-foreground focus:ring-primary/40 h-10 flex-1 rounded-4xl px-4 text-sm ring-1 outline-none"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <HugeiconsIcon icon={SentIcon} size={18} />
          </Button>
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

function MessageBubble({
  message,
}: {
  message: { role: string; parts: Array<{ type: string; text?: string }> }
}) {
  const isUser = message.role === 'user'
  const text = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')

  if (!text) return null

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-xl">
          <HugeiconsIcon icon={AiChat02Icon} size={16} className="text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
          isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm',
        )}
      >
        {text}
      </div>
    </div>
  )
}
