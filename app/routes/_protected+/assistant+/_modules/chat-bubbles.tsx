import { Link } from 'react-router'
import { Streamdown } from 'streamdown'

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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-primary/5 max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Streamdown
        mode={isStreaming ? 'streaming' : 'static'}
        className="prose prose-sm prose-neutral dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:my-3 max-w-none"
      >
        {text}
      </Streamdown>
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
