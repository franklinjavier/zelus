import { redirect } from 'react-router'
import type { z } from 'zod'

export type FieldErrors = Record<string, string>

/**
 * Reads captchaToken from FormData and returns headers with x-captcha-response set.
 */
export function withCaptchaToken(formData: FormData, request: Request): Headers {
  const headers = new Headers(request.headers)
  const token = formData.get('captchaToken')
  if (token) headers.set('x-captcha-response', String(token))
  return headers
}

/**
 * Extracts set-cookie headers from an auth API response and redirects.
 */
export function redirectWithCookies(res: Response, to: string) {
  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  return redirect(to, { headers })
}

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
