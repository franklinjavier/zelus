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
}: {
  categories: { key: string }[]
  defaultValue?: string | null
  name?: string
}) {
  const items: CategoryItem[] = categories.map((c) => ({
    value: c.key,
    label: translateCategory(c.key),
  }))

  const defaultItem = items.find((i) => i.value === defaultValue) ?? null

  return (
    <Combobox name={name} items={items} defaultValue={defaultItem}>
      <ComboboxInput placeholder="Pesquisar categoria..." className="w-full" showClear />
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
