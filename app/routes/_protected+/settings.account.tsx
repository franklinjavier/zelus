import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { redirect, useNavigation, useSubmit } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/settings.account'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { auth } from '~/lib/auth/auth.server'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Obrigatório'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Obrigatório'),
  confirm: z
    .string()
    .min(1, 'Obrigatório')
    .refine((value) => value === 'APAGAR', { message: 'Digite APAGAR para confirmar' }),
})

type DeleteAccountValues = z.input<typeof deleteAccountSchema>

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Conta — Zelus' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = String(formData.get('_intent') || '')

  if (intent === 'changePassword') {
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const res = await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { error: body?.message || 'Não foi possível alterar a palavra‑passe.' }
    }

    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }

    return Response.json({ success: 'Palavra‑passe alterada com sucesso.' }, { headers })
  }

  if (intent === 'deleteAccount') {
    const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const res = await auth.api.deleteUser({
      body: {
        password: parsed.data.password,
        callbackURL: '/',
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { error: body?.message || 'Não foi possível apagar a conta.' }
    }

    const headers = new Headers()
    for (const cookie of res.headers.getSetCookie()) {
      headers.append('set-cookie', cookie)
    }

    return redirect('/', { headers })
  }

  return { error: 'Ação inválida.' }
}

export default function AccountSettingsPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const submit = useSubmit()
  const submittingIntent =
    navigation.state === 'submitting' ? String(navigation.formData?.get('_intent') || '') : ''
  const isChangingPassword = submittingIntent === 'changePassword'
  const isDeletingAccount = submittingIntent === 'deleteAccount'

  const changeForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  const deleteForm = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '', confirm: '' },
  })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Conta</h1>
        <p className="text-muted-foreground text-sm">
          Segurança e gestão de conta (GDPR): alterar palavra‑passe ou apagar conta.
        </p>
      </header>

      {actionData && 'error' in actionData && typeof actionData.error === 'string' && (
        <div className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
          {actionData.error}
        </div>
      )}
      {actionData && 'success' in actionData && typeof actionData.success === 'string' && (
        <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {actionData.success}
        </div>
      )}

      <Card className="ring-foreground/10 ring-1">
        <CardHeader>
          <CardTitle>Alterar palavra-passe</CardTitle>
          <CardDescription>Recomendado: use uma palavra‑passe forte e única.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="post"
            onSubmit={changeForm.handleSubmit(
              (_d, e) => e?.target && submit(e.target, { method: 'post' }),
            )}
            className="grid gap-4"
          >
            <input type="hidden" name="_intent" value="changePassword" />

            <Controller
              name="currentPassword"
              control={changeForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Palavra-passe atual</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="newPassword"
              control={changeForm.control}
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

            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? 'A guardar…' : 'Guardar'}
            </Button>
          </form>
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
          <form
            method="post"
            onSubmit={deleteForm.handleSubmit(
              (_d, e) => e?.target && submit(e.target, { method: 'post' }),
            )}
            className="grid gap-4"
          >
            <input type="hidden" name="_intent" value="deleteAccount" />

            <Controller
              name="password"
              control={deleteForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Palavra-passe</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="confirm"
              control={deleteForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Confirmação</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Digite APAGAR"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Button type="submit" variant="destructive" disabled={isDeletingAccount}>
              {isDeletingAccount ? 'A apagar…' : 'Apagar conta'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
