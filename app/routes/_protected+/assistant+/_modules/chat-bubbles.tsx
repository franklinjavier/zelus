import { Link } from 'react-router'
import { Streamdown } from 'streamdown'
import { AiChat02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { cn } from '~/lib/utils'

const OPTION_REGEX = /\{\{(.+?)\}\}/g
const INTERNAL_LINK_REGEX = /\[([^\]]+)\]\((\/[^)]+)\)/g

type InternalLink = { label: string; href: string }

function parseAssistantText(text: string): {
  cleanText: string
  options: string[]
  links: InternalLink[]
} {
  const options: string[] = []
  const links: InternalLink[] = []

  let cleaned = text.replace(OPTION_REGEX, (_, option) => {
    options.push(option.trim())
    return ''
  })

  cleaned = cleaned.replace(INTERNAL_LINK_REGEX, (_, label, href) => {
    links.push({ label, href })
    return ''
  })

  return { cleanText: cleaned.trim(), options, links }
}

export function MessageBubble({
  message,
  isStreaming,
  isLast,
  onOptionClick,
}: {
  message: { role: string; parts: Array<{ type: string; text?: string }> }
  isStreaming?: boolean
  isLast?: boolean
  onOptionClick?: (option: string) => void
}) {
  const isUser = message.role === 'user'
  const rawText = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')

  if (!rawText) return null

  const { cleanText, options, links } = isUser
    ? { cleanText: rawText, options: [] as string[], links: [] as InternalLink[] }
    : parseAssistantText(rawText)
  const text = cleanText || rawText

  const showOptions = !isUser && !isStreaming && isLast && options.length > 0 && onOptionClick
  const showLinks = !isUser && !isStreaming && links.length > 0

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-xl">
          <HugeiconsIcon icon={AiChat02Icon} size={16} className="text-primary" />
        </div>
      )}
      <div className="max-w-[80%]">
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
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
        {showLinks && (
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-primary hover:bg-primary/5 ring-primary/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
        {showOptions && (
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onOptionClick(option)}
                className="ring-foreground/10 hover:ring-primary/30 hover:bg-primary/5 rounded-full px-3 py-1.5 text-sm ring-1 transition-all"
              >
                {option}
              </button>
            ))}
          </div>
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
