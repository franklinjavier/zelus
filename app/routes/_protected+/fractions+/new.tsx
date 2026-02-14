import { href, redirect, useNavigation, Form, Link } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createFraction } from '~/lib/services/fractions'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Nova Fração — Zelus' }]
}

const createSchema = z.object({
  label: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  if (effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  const formData = await request.formData()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: 'Nome da fração é obrigatório.' }
  }

  await createFraction(orgId, parsed.data, user.id)
  return redirect(href('/fractions'))
}

export default function NewFractionPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="mx-auto max-w-md">
      <BackButton to={href('/fractions')} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Dados da fração</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            {actionData?.error && <ErrorBanner>{actionData.error}</ErrorBanner>}

            <Field>
              <FieldLabel htmlFor="label">Nome</FieldLabel>
              <Input id="label" name="label" placeholder="Ex: 1 D, RC Esq" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Descrição (opcional)</FieldLabel>
              <Textarea
                id="description"
                name="description"
                placeholder="Notas sobre esta fração"
                rows={3}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button render={<Link to={href('/fractions')} />} variant="outline">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A criar…' : 'Criar fração'}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
