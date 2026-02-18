import { href, redirect, useNavigation, Form } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createFraction } from '~/lib/services/fractions'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
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

export default function NewFractionDrawer({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="px-6 pb-6">
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

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? 'A criar…' : 'Criar fração'}
        </Button>
      </Form>
    </div>
  )
}
