import { cn } from '~/lib/utils'
import { translateCategory } from '~/lib/category-labels'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'

type CategoryItem = { value: string; label: string }

export function CategorySelect({
  categories,
  defaultValue = null,
  name = 'category',
  className,
  onValueChange,
}: {
  categories: { key: string }[]
  defaultValue?: string | null
  name?: string
  className?: string
  onValueChange?: (value: string | null) => void
}) {
  const items: CategoryItem[] = categories.map((c) => ({
    value: c.key,
    label: translateCategory(c.key),
  }))

  const defaultItem = items.find((i) => i.value === defaultValue) ?? null

  return (
    <Combobox
      name={name}
      items={items}
      defaultValue={defaultItem}
      onValueChange={(val) => onValueChange?.(val?.value ?? null)}
    >
      <ComboboxInput className={cn('w-full', className)} showClear />
      <ComboboxContent>
        <ComboboxEmpty>Nenhuma categoria encontrada</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
