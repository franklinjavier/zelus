import { data, Form, redirect, useNavigation } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/settings.account'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { auth } from '~/lib/auth/auth.server'
import { validateForm } from '~/lib/forms'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Obrigatório'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Obrigatório'),
  confirm: z
    .string()
    .min(1, 'Obrigatório')
    .refine((value) => value === 'APAGAR', { message: 'Digite APAGAR para confirmar' }),
})

type ActionData =
  | { intent: 'changePassword'; errors: Record<string, string> }
  | { intent: 'changePassword'; error: string }
  | { intent: 'changePassword'; success: string }
  | { intent: 'deleteAccount'; errors: Record<string, string> }
  | { intent: 'deleteAccount'; error: string }
  | { intent: 'deleteAccount'; success: string }
  | { error: string }

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Conta — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = String(formData.get('_intent') || '')

  if (intent === 'changePassword') {
    const result = validateForm(formData, changePasswordSchema)
    if ('errors' in result) {
      return data({ intent: 'changePassword', errors: result.errors } satisfies ActionData, {
        status: 400,
      })
    }

    const res = await auth.api.changePassword({
      body: {
        currentPassword: result.data.currentPassword,
        newPassword: result.data.newPassword,
        revokeOtherSessions: true,
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return data(
        {
          intent: 'changePassword',
          error: body?.message || 'Não foi possível alterar a palavra‑passe.',
        } satisfies ActionData,
        { status: 400 },
      )
    }

    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }

    return data(
      {
        intent: 'changePassword',
        success: 'Palavra‑passe alterada com sucesso.',
      } satisfies ActionData,
      { headers },
    )
  }

  if (intent === 'deleteAccount') {
    const result = validateForm(formData, deleteAccountSchema)
    if ('errors' in result) {
      return data({ intent: 'deleteAccount', errors: result.errors } satisfies ActionData, {
        status: 400,
      })
    }

    const res = await auth.api.deleteUser({
      body: {
        password: result.data.password,
        callbackURL: '/',
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return data(
        {
          intent: 'deleteAccount',
          error: body?.message || 'Não foi possível apagar a conta.',
        } satisfies ActionData,
        { status: 400 },
      )
    }

    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }

    return redirect('/', { headers })
  }

  return data({ error: 'Ação inválida.' } satisfies ActionData, { status: 400 })
}

export default function AccountSettingsPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const submittingIntent =
    navigation.state === 'submitting' ? String(navigation.formData?.get('_intent') || '') : ''
  const isChangingPassword = submittingIntent === 'changePassword'
  const isDeletingAccount = submittingIntent === 'deleteAccount'

  const intent = actionData && 'intent' in actionData ? actionData.intent : null
  const globalError = actionData && 'error' in actionData ? actionData.error : null

  const changeErrors =
    intent === 'changePassword' && actionData && 'errors' in actionData ? actionData.errors : null
  const deleteErrors =
    intent === 'deleteAccount' && actionData && 'errors' in actionData ? actionData.errors : null

  const success = actionData && 'success' in actionData ? actionData.success : null

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Conta</h1>
        <p className="text-muted-foreground text-sm">
          Segurança e gestão de conta (GDPR): alterar palavra‑passe ou apagar conta.
        </p>
      </header>

      {globalError && (
        <div className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
          {globalError}
        </div>
      )}
      {typeof success === 'string' && (
        <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <Card className="ring-foreground/10 ring-1">
        <CardHeader>
          <CardTitle>Alterar palavra-passe</CardTitle>
          <CardDescription>Recomendado: use uma palavra‑passe forte e única.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            <input type="hidden" name="_intent" value="changePassword" />

            <Field>
              <FieldLabel htmlFor="currentPassword">Palavra-passe atual</FieldLabel>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              {changeErrors?.currentPassword && (
                <FieldError>{changeErrors.currentPassword}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="newPassword">Nova palavra-passe</FieldLabel>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
              />
              {changeErrors?.newPassword && <FieldError>{changeErrors.newPassword}</FieldError>}
            </Field>

            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? 'A guardar…' : 'Guardar'}
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card className="ring-destructive/30 ring-1">
        <CardHeader>
          <CardTitle>Apagar conta</CardTitle>
          <CardDescription>
            Esta ação é permanente. Os seus acessos serão removidos. (Os registos do condomínio
            podem precisar de retenção por auditoria.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            <input type="hidden" name="_intent" value="deleteAccount" />

            <Field>
              <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              {deleteErrors?.password && <FieldError>{deleteErrors.password}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm">Confirmação</FieldLabel>
              <Input
                id="confirm"
                name="confirm"
                placeholder="Digite APAGAR"
                autoComplete="off"
                required
              />
              {deleteErrors?.confirm && <FieldError>{deleteErrors.confirm}</FieldError>}
            </Field>

            <Button type="submit" variant="destructive" disabled={isDeletingAccount}>
              {isDeletingAccount ? 'A apagar…' : 'Apagar conta'}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
