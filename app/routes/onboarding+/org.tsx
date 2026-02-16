import { data, redirect, useFetcher, href } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/org'
import { requireAuth } from '~/lib/auth/rbac'
import { auth } from '~/lib/auth/auth.server'
import { validateForm } from '~/lib/forms'

import { ErrorBanner } from '~/components/layout/feedback'
import { Button } from '~/components/ui/button'
import { Field, FieldLabel, FieldError } from '~/components/ui/field'
import { Input } from '~/components/ui/input'

const createOrgSchema = z.object({
  name: z.string().min(1, 'Nome do condomínio obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
  totalFractions: z.string().optional(),
  notes: z.string().optional(),
})

function forwardCookies(res: Response): Headers {
  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

export async function action({ request, context }: Route.ActionArgs) {
  requireAuth(context)
  const formData = await request.formData()

  const result = validateForm(formData, createOrgSchema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const base = result.data.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 8)
  const slug = `${base}-${suffix}`

  const res = await auth.api.createOrganization({
    body: {
      name: result.data.name,
      slug,
      city: result.data.city || undefined,
      totalFractions: result.data.totalFractions || undefined,
      notes: result.data.notes || undefined,
    },
    asResponse: true,
    headers: request.headers,
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    return data({ error: errData?.message || 'Erro ao criar organização.' }, { status: 500 })
  }

  const orgData = await res.json()
  throw redirect(`${href('/onboarding/fractions')}?orgId=${orgData.id}`, {
    headers: forwardCookies(res),
  })
}

export default function OnboardingOrg() {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state === 'submitting'

  const serverError =
    fetcher.data && 'error' in fetcher.data ? (fetcher.data.error as string) : null
  const fieldErrors =
    fetcher.data && 'errors' in fetcher.data
      ? (fetcher.data.errors as Record<string, string>)
      : null

  return (
    <>
      {serverError && <ErrorBanner className="mb-4">{serverError}</ErrorBanner>}
      <fetcher.Form method="post" className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="name">Nome do condomínio *</FieldLabel>
          <Input id="name" name="name" placeholder="Ex: Edifício Aurora" required />
          {fieldErrors?.name && <FieldError>{fieldErrors.name}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="city">Cidade / localização *</FieldLabel>
          <Input id="city" name="city" placeholder="Ex: Lisboa" required />
          {fieldErrors?.city && <FieldError>{fieldErrors.city}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="totalFractions">Número total de frações</FieldLabel>
          <Input id="totalFractions" name="totalFractions" type="number" placeholder="Ex: 12" />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notas internas</FieldLabel>
          <Input id="notes" name="notes" placeholder="Opcional" />
        </Field>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'A criar…' : 'Continuar'}
        </Button>
      </fetcher.Form>
    </>
  )
}
