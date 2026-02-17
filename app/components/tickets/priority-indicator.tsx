import { useState } from 'react'
import { cn } from '~/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  NoPriorityIcon,
  UrgentIcon,
  HighPriorityIcon,
  MediumPriorityIcon,
  LowPriorityIcon,
} from './priority-icons'

type Priority = 'urgent' | 'high' | 'medium' | 'low' | null

const priorityLabels: Record<string, string> = {
  '': 'Sem prioridade',
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const priorityConfig: Record<
  string,
  { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; className: string }
> = {
  urgent: { icon: UrgentIcon, className: 'text-red-600' },
  high: { icon: HighPriorityIcon, className: 'text-orange-500' },
  medium: { icon: MediumPriorityIcon, className: 'text-amber-500' },
  low: { icon: LowPriorityIcon, className: 'text-emerald-600' },
  '': { icon: NoPriorityIcon, className: 'text-muted-foreground' },
}

function PriorityIndicator({ priority }: { priority: Priority }) {
  const key = priority ?? ''
  const { icon: Icon, className } = priorityConfig[key]
  const label = priorityLabels[key]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <Icon className="size-4" />
      {label}
    </span>
  )
}

const priorityItems = Object.entries(priorityLabels).map(([value, label]) => ({ label, value }))

function PrioritySelector({
  name,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className: triggerClassName,
}: {
  name?: string
  defaultValue?: string
  value?: string
  onValueChange?: (value: string | null) => void
  className?: string
}) {
  const isControlled = controlledValue !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const current = isControlled ? controlledValue : internal
  const { icon: CurrentIcon, className: currentClassName } =
    priorityConfig[current] ?? priorityConfig['']

  return (
    <Select
      name={name}
      value={current}
      onValueChange={(v) => {
        if (!isControlled) setInternal(v ?? '')
        onValueChange?.(v)
      }}
      items={priorityItems}
    >
      <SelectTrigger className={cn('w-full', currentClassName, triggerClassName)}>
        <CurrentIcon className="size-5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-48">
        {Object.entries(priorityConfig).map(([value, { icon: Icon, className }]) => (
          <SelectItem key={value} value={value} className={cn(className)}>
            <Icon className="size-5" />
            {priorityLabels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { PriorityIndicator, PrioritySelector, priorityConfig, priorityLabels }
export type { Priority }
