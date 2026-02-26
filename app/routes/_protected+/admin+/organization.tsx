import { useState } from 'react'
import { data, Form, useFetcher } from 'react-router'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Route } from './+types/organization'
import { orgContext } from '~/lib/auth/context'
import { validateForm } from '~/lib/forms'
import { db } from '~/lib/db'
import { organization } from '~/lib/db/schema'
import { setToast } from '~/lib/toast.server'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'
import {
  enableInviteLink,
  disableInviteLink,
  regenerateInviteCode,
} from '~/lib/services/invite-link.server'
import { Copy01Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Condomínio — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)

  const org = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      city: organization.city,
      totalFractions: organization.totalFractions,
      notes: organization.notes,
      language: organization.language,
      timezone: organization.timezone,
      inviteCode: organization.inviteCode,
      inviteEnabled: organization.inviteEnabled,
    })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
    .then((rows) => rows[0])

  if (!org) throw new Response('Not Found', { status: 404 })

  const origin = new URL(request.url).origin

  return { org, origin }
}

const updateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  city: z.string().optional().default(''),
  totalFractions: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  language: z.enum(['pt-PT', 'pt-BR', 'en']),
  timezone: z.string().min(1, 'Fuso horário é obrigatório'),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'toggle-invite') {
    const currentlyEnabled = formData.get('enabled') === 'true'
    if (currentlyEnabled) {
      await disableInviteLink(orgId)
    } else {
      await enableInviteLink(orgId)
    }
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'regenerate-invite') {
    await regenerateInviteCode(orgId)
    return data({ success: true }, { headers: await setToast('Link regenerado.') })
  }

  // Default: org update form
  const result = validateForm(formData, updateSchema)
  if ('errors' in result) {
    return { errors: result.errors }
  }

  const { name, city, totalFractions, notes, language, timezone } = result.data

  await db
    .update(organization)
    .set({
      name,
      city: city || null,
      totalFractions: totalFractions || null,
      notes: notes || null,
      language,
      timezone,
    })
    .where(eq(organization.id, orgId))

  return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
}

const languages = [
  { value: 'pt-PT', label: 'Português (Portugal)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
]

const timezones = [
  { value: 'Europe/Lisbon', label: 'Lisboa (Europe/Lisbon)' },
  { value: 'Atlantic/Azores', label: 'Açores (Atlantic/Azores)' },
  { value: 'Atlantic/Madeira', label: 'Madeira (Atlantic/Madeira)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (America/Sao_Paulo)' },
  { value: 'Europe/London', label: 'Londres (Europe/London)' },
]

export default function OrganizationPage({ loaderData, actionData }: Route.ComponentProps) {
  const { org } = loaderData
  const errors = actionData && 'errors' in actionData ? actionData.errors : undefined

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Condomínio</h1>
        <p className="text-muted-foreground text-sm">
          Gerir as informações e definições do condomínio.
        </p>
      </div>

      {actionData && 'errors' in actionData && <ErrorBanner>Corrija os erros abaixo.</ErrorBanner>}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações gerais</CardTitle>
            <CardDescription>Nome, localização e detalhes do condomínio.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field>
              <FieldLabel htmlFor="org-name">
                Nome <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="org-name" name="name" type="text" defaultValue={org.name} required />
              {errors?.name && <FieldError>{errors.name}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="org-city">Cidade</FieldLabel>
              <Input
                id="org-city"
                name="city"
                type="text"
                defaultValue={org.city ?? ''}
                placeholder="ex: Lisboa"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="org-fractions">Total de frações</FieldLabel>
              <Input
                id="org-fractions"
                name="totalFractions"
                type="text"
                defaultValue={org.totalFractions ?? ''}
                placeholder="ex: 24"
              />
              <FieldDescription>Número total de frações no condomínio.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="org-notes">Notas</FieldLabel>
              <Textarea
                id="org-notes"
                name="notes"
                defaultValue={org.notes ?? ''}
                placeholder="Notas internas sobre o condomínio..."
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Localização e idioma</CardTitle>
            <CardDescription>Fuso horário e idioma da interface.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field>
              <FieldLabel htmlFor="org-language">Idioma</FieldLabel>
              <Select name="language" defaultValue={org.language}>
                <SelectTrigger id="org-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.language && <FieldError>{errors.language}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="org-timezone">Fuso horário</FieldLabel>
              <Select name="timezone" defaultValue={org.timezone}>
                <SelectTrigger id="org-timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.timezone && <FieldError>{errors.timezone}</FieldError>}
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Guardar alterações
          </Button>
        </div>
      </Form>

      <InviteLinkCard org={org} origin={loaderData.origin} />
    </div>
  )
}

function InviteLinkCard({
  org,
  origin,
}: {
  org: { inviteCode: string | null; inviteEnabled: boolean }
  origin: string
}) {
  const fetcher = useFetcher()
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const isSubmitting = fetcher.state !== 'idle'

  // Optimistic state
  const isEnabled = fetcher.formData
    ? fetcher.formData.get('intent') === 'toggle-invite'
      ? fetcher.formData.get('enabled') !== 'true'
      : org.inviteEnabled
    : org.inviteEnabled

  const inviteUrl = org.inviteCode ? `${origin}/join/${org.inviteCode}` : null

  const copyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Link de convite</CardTitle>
            <CardDescription>
              Partilhe este link para que novos membros possam juntar-se ao condomínio.
            </CardDescription>
          </div>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="toggle-invite" />
            <input type="hidden" name="enabled" value={String(org.inviteEnabled)} />
            <Button
              type="submit"
              variant={isEnabled ? 'outline' : 'default'}
              disabled={isSubmitting}
            >
              {isEnabled ? 'Desativar' : 'Ativar'}
            </Button>
          </fetcher.Form>
        </div>
      </CardHeader>
      {isEnabled && inviteUrl && (
        <CardContent>
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteUrl} className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyLink}>
              <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={2} />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {copied ? 'Copiado!' : 'Qualquer pessoa com este link pode juntar-se.'}
            </p>
            {confirmRegen ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">O link atual será invalidado.</span>
                <fetcher.Form method="post" onSubmit={() => setConfirmRegen(false)}>
                  <input type="hidden" name="intent" value="regenerate-invite" />
                  <Button type="submit" variant="destructive" disabled={isSubmitting}>
                    Confirmar
                  </Button>
                </fetcher.Form>
                <Button variant="ghost" onClick={() => setConfirmRegen(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRegen(true)}>
                <HugeiconsIcon
                  icon={RefreshIcon}
                  data-icon="inline-start"
                  size={16}
                  strokeWidth={2}
                />
                Regenerar
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
