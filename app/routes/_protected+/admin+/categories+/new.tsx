import { Form, redirect, href } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createCategory } from '~/lib/services/categories.server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'

const createSchema = z.object({
  key: z
    .string()
    .min(1, 'Chave é obrigatória')
    .regex(/^[a-z][a-z0-9_]*$/, 'Apenas letras minúsculas, números e underscore'),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  const parsed = createSchema.safeParse(fields)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return { error: msg }
  }

  const result = await createCategory(parsed.data.key, user.id, orgId)
  if (!result) return { error: 'Categoria já existe.' }
  return redirect(href('/admin/categories'), { headers: await setToast('Categoria criada.') })
}

export default function NewCategoryPage({ actionData }: Route.ComponentProps) {
  return (
    <div className="px-6 pb-6">
      {actionData && 'error' in actionData && (
        <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
      )}

      <Form method="post" className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="cat-key">
            Chave <span className="text-destructive">*</span>
          </FieldLabel>
          <Input id="cat-key" name="key" type="text" placeholder="ex: plumbing" required />
        </Field>
        <Button type="submit" className="mt-1">
          Criar categoria
        </Button>
      </Form>
    </div>
  )
}
