import { useSearchParams, useSubmit } from 'react-router'

export function useFilterParams() {
  const [searchParams] = useSearchParams()
  const submit = useSubmit()

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams)
    if (!value || value === '_all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    submit(params)
  }

  return { searchParams, setFilter }
}
