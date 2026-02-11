import { useState } from 'react'
import { data, redirect, useFetcher } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/index'
import { requireAuth } from '~/lib/auth/rbac'
import { auth } from '~/lib/auth/auth.server'
import { db } from '~/lib/db'
import { fractions, member } from '~/lib/db/schema'
import { eq } from 'drizzle-orm'
import { validateForm } from '~/lib/forms'

import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ErrorBanner } from '~/components/layout/feedback'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldLabel, FieldError } from '~/components/ui/field'
import { Input } from '~/components/ui/input'

const createOrgSchema = z.object({
  name: z.string().min(1, 'Nome do condomínio obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
  totalFractions: z.string().optional(),
  notes: z.string().optional(),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Configurar Condomínio — Zelus' }]
}

function forwardCookies(res: Response): Headers {
  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { session, user } = requireAuth(context)

  if (session.session.activeOrganizationId) {
    throw redirect('/dashboard')
  }

  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, user.id))
    .limit(1)

  if (memberships.length > 0) {
    const res = await auth.api.setActiveOrganization({
      body: { organizationId: memberships[0].organizationId },
      asResponse: true,
      headers: request.headers,
    })
    throw redirect('/dashboard', { headers: forwardCookies(res) })
  }

  return { userName: user.name }
}

export async function action({ request, context }: Route.ActionArgs) {
  requireAuth(context)
  const formData = await request.formData()
  const intent = formData.get('intent') as string

  if (intent === 'create-org') {
    const result = validateForm(formData, createOrgSchema)
    if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

    const slug = result.data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

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
      return { error: errData?.message || 'Erro ao criar organização.' }
    }

    const orgData = await res.json()
    return data({ orgId: orgData.id as string, step: 2 }, { headers: forwardCookies(res) })
  }

  if (intent === 'create-fractions') {
    const orgId = formData.get('orgId') as string
    const labels = formData.getAll('label') as string[]

    for (const label of labels) {
      if (label.trim()) {
        await db.insert(fractions).values({
          orgId,
          label: label.trim(),
        })
      }
    }

    return { orgId, step: 3 }
  }

  if (intent === 'finish') {
    const orgId = formData.get('orgId') as string
    const res = await auth.api.setActiveOrganization({
      body: { organizationId: orgId },
      asResponse: true,
      headers: request.headers,
    })
    return redirect('/dashboard', { headers: forwardCookies(res) })
  }

  return { error: 'Ação desconhecida.' }
}

export default function OnboardingPage() {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state === 'submitting'

  const [step, setStep] = useState(1)
  const [orgId, setOrgId] = useState('')
  const [prevData, setPrevData] = useState<typeof fetcher.data>(undefined)
  const [fractionLabels, setFractionLabels] = useState([''])

  // Sync state from fetcher responses (derived state pattern)
  if (fetcher.data !== prevData) {
    setPrevData(fetcher.data)
    if (fetcher.data && 'orgId' in fetcher.data) setOrgId(fetcher.data.orgId as string)
    if (fetcher.data && 'step' in fetcher.data) setStep(fetcher.data.step as number)
  }

  const serverError =
    fetcher.data && 'error' in fetcher.data ? (fetcher.data.error as string) : null
  const fieldErrors =
    fetcher.data && 'errors' in fetcher.data
      ? (fetcher.data.errors as Record<string, string>)
      : null

  function handleFinish() {
    const formData = new FormData()
    formData.set('intent', 'finish')
    formData.set('orgId', orgId)
    fetcher.submit(formData, { method: 'post' })
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AzulejoPattern />
      <Card className="relative z-10 w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ZelusLogoTile size={40} className="text-primary" />
          </div>
          <CardTitle>
            {step === 1 && 'Configurar condomínio'}
            {step === 2 && 'Adicionar frações'}
            {step === 3 && 'Tudo pronto!'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'Passo 1 de 3 — Dados do condomínio'}
            {step === 2 && 'Passo 2 de 3 — Frações do edifício'}
            {step === 3 && 'Passo 3 de 3 — Configuração concluída'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serverError && <ErrorBanner className="mb-4">{serverError}</ErrorBanner>}

          {step === 1 && (
            <fetcher.Form method="post" className="grid gap-4">
              <input type="hidden" name="intent" value="create-org" />
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
                <Input
                  id="totalFractions"
                  name="totalFractions"
                  type="number"
                  placeholder="Ex: 12"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notas internas</FieldLabel>
                <Input id="notes" name="notes" placeholder="Opcional" />
              </Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A criar…' : 'Continuar'}
              </Button>
            </fetcher.Form>
          )}

          {step === 2 && (
            <fetcher.Form method="post" className="grid gap-4">
              <input type="hidden" name="intent" value="create-fractions" />
              <input type="hidden" name="orgId" value={orgId} />
              <p className="text-muted-foreground text-sm">
                Adicione as frações do edifício. Pode usar nomes livres (ex: &quot;T3 – 2º
                Esq.&quot;).
              </p>
              {fractionLabels.map((value, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    name="label"
                    value={value}
                    onChange={(e) => {
                      const next = [...fractionLabels]
                      next[index] = e.target.value
                      setFractionLabels(next)
                    }}
                    placeholder={`Fração ${index + 1}`}
                    className="flex-1"
                  />
                  {fractionLabels.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setFractionLabels(fractionLabels.filter((_, i) => i !== index))
                      }
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setFractionLabels([...fractionLabels, ''])}
              >
                + Adicionar fração
              </Button>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'A guardar…' : 'Continuar'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                  Saltar
                </Button>
              </div>
            </fetcher.Form>
          )}

          {step === 3 && (
            <div className="grid gap-4 text-center">
              <p className="text-muted-foreground text-sm">
                O seu condomínio está configurado. Pode convidar administradores adicionais mais
                tarde nas definições.
              </p>
              <Button onClick={handleFinish} disabled={isSubmitting}>
                {isSubmitting ? 'A entrar…' : 'Ir para o painel'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
