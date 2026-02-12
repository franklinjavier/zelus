import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, redirect, useLocation, useNavigation, useSubmit } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/reset-password'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { auth } from '~/lib/auth/auth.server'

const schema = z.object({
  token: z.string().min(1, 'Token inválido'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

type Values = z.infer<typeof schema>

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Redefinir palavra-passe — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const parsed = schema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const { token, newPassword } = parsed.data

  const res = await auth.api.resetPassword({
    body: { token, newPassword },
    asResponse: true,
    headers: request.headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return { error: body?.message || 'Não foi possível redefinir a palavra‑passe.' }
  }

  return redirect('/login?reset=1')
}

export default function ResetPasswordPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const submit = useSubmit()
  const location = useLocation()
  const isSubmitting = navigation.state === 'submitting'

  const tokenFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return sp.get('token') || ''
  }, [location.search])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { token: tokenFromUrl, newPassword: '' },
  })

  function onValid(_data: Values, e?: React.BaseSyntheticEvent) {
    if (e?.target) submit(e.target, { method: 'post' })
  }

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
          <form method="post" onSubmit={form.handleSubmit(onValid)} className="grid gap-4">
            {actionData?.error && (
              <div className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
                {actionData.error}
              </div>
            )}

            <Controller
              name="token"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Token</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Cole o token recebido por e-mail"
                    autoComplete="one-time-code"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="newPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Nova palavra-passe</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'A redefinir…' : 'Redefinir palavra‑passe'}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
