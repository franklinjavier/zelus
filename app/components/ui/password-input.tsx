import * as React from 'react'
import { ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { cn } from '~/lib/utils'
import { Input } from '~/components/ui/input'

function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', !visible && 'text-xl tracking-widest', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
      >
        <HugeiconsIcon icon={visible ? ViewOffSlashIcon : ViewIcon} size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

export { PasswordInput }
