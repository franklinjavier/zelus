'use client'

import { useState } from 'react'
import { Copy01Icon, Link01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { AzulejoOverlay } from '~/components/brand/azulejo-overlay'
import { Button } from '~/components/ui/button'

export function InviteLinkCard({ url, card = true }: { url: string; card?: boolean }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const content = (
    <div className="relative">
      <div className="flex items-center gap-2.5">
        <div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
          <HugeiconsIcon icon={Link01Icon} size={18} strokeWidth={2} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Convidar para o condomínio</p>
          <p className="text-muted-foreground text-sm">
            Partilhe este link para novos membros se juntarem.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="bg-muted flex-1 truncate rounded-xl px-3 py-2 font-mono text-sm">{url}</div>
        <Button variant="outline" size="sm" onClick={copy}>
          <HugeiconsIcon
            icon={copied ? Tick02Icon : Copy01Icon}
            data-icon="inline-start"
            size={16}
            strokeWidth={2}
          />
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  )

  if (!card) return content

  return (
    <div className="group bg-card ring-foreground/10 hover:ring-primary/20 relative mt-6 overflow-hidden rounded-2xl p-5 ring-1 transition-all duration-300">
      <AzulejoOverlay />
      {content}
    </div>
  )
}
