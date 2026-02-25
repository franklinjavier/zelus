import { data, Form, href, Link, redirect, useNavigation, useSearchParams } from 'react-router'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'

import type { Route } from './+types/reset-password'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { PasswordInput } from '~/components/ui/password-input'
import { auth } from '~/lib/auth/auth.server'
import { db } from '~/lib/db'
import { verification } from '~/lib/db/schema'
import { validateForm } from '~/lib/forms'

const schema = z.object({
  token: z.string().min(1, 'Token inválido'),
  newPassword: z.string().min(1, 'Palavra-passe obrigatória'),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Redefinir palavra-passe — Zelus' }]
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  const redirectParam = url.searchParams.get('redirect')
  const loginUrl = (extra?: string) =>
    `${href('/login')}?${new URLSearchParams({ ...(extra ? { error: extra } : {}), ...(redirectParam ? { redirect: redirectParam } : {}) }).toString()}`

  if (!token) {
    throw redirect(loginUrl())
  }

  const [row] = await db
    .select({ id: verification.id })
    .from(verification)
    .where(
      and(
        eq(verification.identifier, `reset-password:${token}`),
        gt(verification.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!row) {
    throw redirect(loginUrl('invalid-token'))
  }

  return { token }
}

export async function action({ request }: Route.ActionArgs) {
  const result = validateForm(await request.formData(), schema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const { token, newPassword } = result.data

  const res = await auth.api.resetPassword({
    body: { token, newPassword },
    asResponse: true,
    headers: request.headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return data(
      { error: body?.message || 'Não foi possível redefinir a palavra‑passe.' },
      { status: 400 },
    )
  }

  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }

  const url = new URL(request.url)
  const redirectParam = url.searchParams.get('redirect')
  const loginUrl = `${href('/login')}?reset=1${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ''}`
  return redirect(loginUrl, { headers })
}

export default function ResetPasswordPage({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const isSubmitting = navigation.state === 'submitting'
  const redirectParam = searchParams.get('redirect')

  const errors = actionData && 'errors' in actionData ? actionData.errors : null
  const error = actionData && 'error' in actionData ? actionData.error : null

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>Redefinir palavra-passe</CardTitle>
          <CardDescription>Escolha uma nova palavra‑passe para a sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            <input type="hidden" name="token" value={loaderData.token} />

            {error && (
              <div className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="newPassword">Nova palavra-passe</FieldLabel>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                autoComplete="new-password"
                required
              />
              {errors?.newPassword && <FieldError>{errors.newPassword}</FieldError>}
            </Field>

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'A redefinir…' : 'Redefinir palavra‑passe'}
            </Button>
          </Form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            <Link
              to={`${href('/login')}${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}`}
              className="text-primary hover:underline"
            >
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
