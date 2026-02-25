import { data, Form, href, Link, useNavigation, useSearchParams } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/register'
import { auth } from '~/lib/auth/auth.server'
import { signIn } from '~/lib/auth/auth.client'
import { GoogleIcon } from '~/components/auth/google-icon'
import { Turnstile } from '~/components/auth/turnstile'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldLabel, FieldDescription, FieldError } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { PasswordInput } from '~/components/ui/password-input'
import { Separator } from '~/components/ui/separator'
import { ErrorBanner } from '~/components/layout/feedback'
import { redirectWithCookies, validateForm, withCaptchaToken } from '~/lib/forms'
import { getSafeRedirect } from '~/lib/misc/safe-redirect'

const registerSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Palavra-passe obrigatória'),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Criar Conta — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const result = validateForm(formData, registerSchema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const { name, email, password } = result.data

  const res = await auth.api.signUpEmail({
    body: { name, email, password },
    asResponse: true,
    headers: withCaptchaToken(formData, request),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return { error: body?.message || 'Erro ao criar conta.' }
  }

  return redirectWithCookies(res, getSafeRedirect(request, href('/onboarding')))
}

export default function RegisterPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? ''
  const defaultEmail = searchParams.get('email') ?? ''
  const isSubmitting = navigation.state === 'submitting'
  const errors = actionData && 'errors' in actionData ? actionData.errors : null
  const error = actionData && 'error' in actionData ? actionData.error : null
  const callbackURL =
    redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : href('/onboarding')

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Comece a gerir o seu condomínio</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn.social({ provider: 'google', callbackURL })}
          >
            <GoogleIcon />
            Registar com Google
          </Button>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">ou</span>
            <Separator className="flex-1" />
          </div>

          <Form method="post" className="grid gap-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input id="name" name="name" placeholder="Nome" autoComplete="name" required />
              {errors?.name && <FieldError>{errors.name}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nome@exemplo.com"
                autoComplete="email"
                defaultValue={defaultEmail}
                required
              />
              {errors?.email && <FieldError>{errors.email}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
              <PasswordInput id="password" name="password" autoComplete="new-password" required />
              {errors?.password && <FieldError>{errors.password}</FieldError>}
            </Field>
            <Turnstile />
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'A criar…' : 'Criar conta'}
            </Button>
          </Form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            Já tem conta?{' '}
            <Link
              to={`${href('/login')}${redirectTo || defaultEmail ? `?${new URLSearchParams(Object.entries({ redirect: redirectTo, email: defaultEmail }).filter(([, v]) => v)).toString()}` : ''}`}
              className="text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
