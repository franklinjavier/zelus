import { Form } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/categories'
import { orgContext, userContext } from '~/lib/auth/context'
import { listCategories, createCategory, deleteCategory } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner, SuccessBanner } from '~/components/layout/feedback'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Categorias — Zelus' }]
}

export async function loader() {
  const categories = await listCategories()
  return { categories }
}

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
  const data = Object.fromEntries(formData)

  if (data.intent === 'create') {
    const parsed = createSchema.safeParse(data)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
      return { error: msg }
    }

    const result = await createCategory(parsed.data.key, user.id, orgId)
    if (!result) return { error: 'Categoria já existe.' }
    return { success: true }
  }

  if (data.intent === 'delete') {
    const key = String(data.key)

    try {
      await deleteCategory(key, user.id, orgId)
      return { success: true }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar categoria.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function CategoriesPage({ loaderData, actionData }: Route.ComponentProps) {
  const { categories } = loaderData

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Categorias</h1>

      {actionData?.error && <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>}
      {actionData?.success && <SuccessBanner className="mt-4">Alterações guardadas.</SuccessBanner>}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Nova categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-3">
                <input type="hidden" name="intent" value="create" />
                <Field>
                  <FieldLabel htmlFor="cat-key">
                    Chave <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input id="cat-key" name="key" type="text" placeholder="ex: plumbing" required />
                </Field>
                <Button type="submit" className="mt-1">
                  Criar
                </Button>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {categories.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  Nenhuma categoria criada.
                </p>
              ) : (
                <div className="divide-y">
                  {categories.map((cat) => (
                    <div key={cat.key} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{translateCategory(cat.key)}</p>
                        <p className="text-muted-foreground text-sm">{cat.key}</p>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="key" value={cat.key} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                        >
                          Apagar
                        </Button>
                      </Form>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
