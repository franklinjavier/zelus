import type { z } from 'zod'

export type FieldErrors = Record<string, string>

export function validateForm<T extends z.ZodType>(
  formData: FormData,
  schema: T,
): { data: z.infer<T> } | { errors: FieldErrors } {
  const parsed = schema.safeParse(Object.fromEntries(formData))

  if (parsed.success) {
    return { data: parsed.data }
  }

  const errors: FieldErrors = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (key && !errors[String(key)]) errors[String(key)] = issue.message
  }
  return { errors }
}
