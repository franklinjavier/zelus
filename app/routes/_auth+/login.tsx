import { useEffect } from 'react'
import { data, Form, Link, redirect, useNavigate, useNavigation } from 'react-router'
import { z } from 'zod'

import { GoogleIcon } from '~/components/auth/google-icon'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Separator } from '~/components/ui/separator'
import { ErrorBanner } from '~/components/layout/feedback'
import { authClient, signIn } from '~/lib/auth/auth.client'
import { auth } from '~/lib/auth/auth.server'
import { validateForm } from '~/lib/forms'
import type { Route } from './+types/login'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Palavra-passe obrigatória'),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Entrar — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const result = validateForm(await request.formData(), loginSchema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const { email, password } = result.data

  const res = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
    headers: request.headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return { error: body?.message || 'Credenciais inválidas.' }
  }

  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }

  return redirect('/dashboard', { headers })
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const navigate = useNavigate()
  const isSubmitting = navigation.state === 'submitting'
  const errors = actionData && 'errors' in actionData ? actionData.errors : null
  const error = actionData && 'error' in actionData ? actionData.error : null

  useEffect(() => {
    authClient.oneTap({
      fetchOptions: {
        onSuccess: () => {
          navigate('/dashboard')
        },
      },
    })
  }, [navigate])

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>Entrar no Zelus</CardTitle>
          <CardDescription>Acesse o sistema do seu condomínio</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
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
            <Field>
              <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              {errors?.password && <FieldError>{errors.password}</FieldError>}
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'A entrar…' : 'Entrar'}
            </Button>
          </Form>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">ou</span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn.social({ provider: 'google', callbackURL: '/dashboard' })}
          >
            <GoogleIcon />
            Entrar com Google
          </Button>

          <div className="mt-4 grid gap-2 text-center text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Esqueceu a palavra-passe?
            </Link>
            <p className="text-muted-foreground">
              Não tem conta?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
