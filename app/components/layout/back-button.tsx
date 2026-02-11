import { Link } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'

import { Button } from '~/components/ui/button'

export function BackButton({ to }: { to: string }) {
  return (
    <Button render={<Link to={to} />} variant="ghost">
      <HugeiconsIcon icon={ArrowLeft02Icon} data-icon="inline-start" size={16} strokeWidth={2} />
      Voltar
    </Button>
  )
}
