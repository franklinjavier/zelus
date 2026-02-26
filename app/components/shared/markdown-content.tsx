import { Streamdown } from 'streamdown'

import { decodeHtmlEntities } from '~/lib/html-decode'
import { cn } from '~/lib/utils'

export function MarkdownContent({ children, className }: { children: string; className?: string }) {
  return (
    <Streamdown
      mode="static"
      className={cn(
        'prose prose-sm prose-neutral dark:prose-invert prose-headings:text-base prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:my-3 max-w-none',
        className,
      )}
    >
      {decodeHtmlEntities(children)}
    </Streamdown>
  )
}
