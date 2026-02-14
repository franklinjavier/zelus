import { data, Form, Link, redirect, useNavigation, useSearchParams } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/forgot-password'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { auth } from '~/lib/auth/auth.server'
import { validateForm } from '~/lib/forms'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Recuperar palavra-passe — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const result = validateForm(await request.formData(), schema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const { email } = result.data

  try {
    // Never reveal whether an email exists.
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
  const [searchParams] = useSearchParams()
  const isSubmitting = navigation.state === 'submitting'

  const sent = searchParams.get('sent')
  const errors = actionData && 'errors' in actionData ? actionData.errors : null

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
            <Form method="post" className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nome@exemplo.com"
                  autoComplete="email"
                  required
                />
                {errors?.email && <FieldError>{errors.email}</FieldError>}
              </Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A enviar…' : 'Enviar link'}
              </Button>
            </Form>
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
