import { Streamdown } from 'streamdown'
import { AiChat02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { cn } from '~/lib/utils'

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: { role: string; parts: Array<{ type: string; text?: string }> }
  isStreaming?: boolean
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
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap'
            : 'bg-muted rounded-tl-sm',
        )}
      >
        {isUser ? (
          text
        ) : (
          <Streamdown
            mode={isStreaming ? 'streaming' : 'static'}
            className="[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          >
            {text}
          </Streamdown>
        )}
      </div>
    </div>
  )
}

export function LoadingBubble() {
  return (
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
  )
}
