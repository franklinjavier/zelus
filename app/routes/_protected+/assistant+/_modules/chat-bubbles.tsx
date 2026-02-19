import { Link } from 'react-router'
import { Streamdown } from 'streamdown'

import { renderToolOutput } from './tool-renderers'

const OPTION_REGEX = /\{\{(.+?)\}\}/g
const INTERNAL_LINK_REGEX = /\[([^\]]+)\]\((\/[^)]+)\)/g

type InternalLink = { label: string; href: string }

function extractOptionsAndLinks(text: string): {
  options: string[]
  links: InternalLink[]
} {
  const options: string[] = []
  const links: InternalLink[] = []

  for (const match of text.matchAll(OPTION_REGEX)) {
    options.push(match[1].trim())
  }
  for (const match of text.matchAll(INTERNAL_LINK_REGEX)) {
    links.push({ label: match[1], href: match[2] })
  }

  return { options, links }
}

function stripOptionsAndLinks(text: string): string {
  return text.replace(OPTION_REGEX, '').replace(INTERNAL_LINK_REGEX, '').trim()
}

type MessagePart = {
  type: string
  text?: string
  state?: string
  output?: unknown
}

export function MessageBubble({
  message,
  isStreaming,
  isLast,
  onOptionClick,
}: {
  message: { role: string; parts: MessagePart[] }
  isStreaming?: boolean
  isLast?: boolean
  onOptionClick?: (option: string) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    const text = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('')
    if (!text) return null
    return (
      <div className="flex justify-end">
        <div className="bg-primary/5 max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    )
  }

  // Assistant message — parts-based rendering
  const rawText = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')

  const { options, links } = extractOptionsAndLinks(rawText)

  const showOptions = !isStreaming && isLast && options.length > 0 && onOptionClick
  const showLinks = !isStreaming && links.length > 0

  const hasContent = message.parts.some(
    (p) => (p.type === 'text' && p.text?.trim()) || p.type.startsWith('tool-'),
  )
  if (!hasContent) return null

  return (
    <div>
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          const cleaned = stripOptionsAndLinks(part.text ?? '')
          if (!cleaned) return null
          return (
            <Streamdown
              key={i}
              mode={isStreaming ? 'streaming' : 'static'}
              className="prose prose-sm prose-neutral dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:my-3 max-w-none"
            >
              {cleaned}
            </Streamdown>
          )
        }

        if (part.type.startsWith('tool-')) {
          const toolName = part.type.slice(5)

          if (part.state !== 'output-available') {
            return <ToolLoading key={i} />
          }

          const customOutput = renderToolOutput(toolName, part.output)
          if (!customOutput) return null
          return <div key={i}>{customOutput}</div>
        }

        return null
      })}
      {showLinks && (
        <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-3 flex flex-wrap gap-2">
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
  )
}

function ToolLoading() {
  return (
    <div className="text-muted-foreground my-2 flex items-center gap-2 text-sm">
      <span className="bg-primary/60 size-1.5 animate-pulse rounded-full" />
      <span>A processar...</span>
    </div>
  )
}

export function LoadingBubble() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span
        className="bg-foreground/30 size-1.5 animate-bounce rounded-full"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="bg-foreground/30 size-1.5 animate-bounce rounded-full"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="bg-foreground/30 size-1.5 animate-bounce rounded-full"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  )
}
