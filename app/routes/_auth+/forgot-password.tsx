import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, redirect, useNavigation, useSubmit } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/forgot-password'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { auth } from '~/lib/auth/auth.server'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

type Values = z.infer<typeof schema>

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Recuperar palavra-passe — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const parsed = schema.safeParse(Object.fromEntries(formData))

  // Always return a generic success message to avoid leaking whether an email exists.
  if (!parsed.success) {
    return { ok: true }
  }

  const { email } = parsed.data

  try {
    // Note: In production you must wire an email provider (Resend) so users actually receive the link.
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: '/reset-password',
      },
      headers: request.headers,
    })
  } catch {
    // Swallow — never reveal whether the email exists.
  }

  return redirect('/forgot-password?sent=1')
}

export default function ForgotPasswordPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const submit = useSubmit()
  const isSubmitting = navigation.state === 'submitting'
  const sent =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sent') : null

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
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
          <CardTitle>Recuperar palavra-passe</CardTitle>
          <CardDescription>
            {sent
              ? 'Se existir uma conta com este e-mail, enviámos um link para redefinir a palavra‑passe.'
              : 'Vamos enviar um link para redefinir a sua palavra‑passe.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent && (
            <form method="post" onSubmit={form.handleSubmit(onValid)} className="grid gap-4">
              {/* intentionally no error message (avoid leaking account existence) */}
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="email"
                      placeholder="nome@exemplo.com"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A enviar…' : 'Enviar link'}
              </Button>
            </form>
          )}

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
