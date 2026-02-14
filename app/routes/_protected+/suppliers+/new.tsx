import { href, redirect, useNavigation, Form, Link } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createSupplier } from '~/lib/services/suppliers'
import { listCategories } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Novo Fornecedor — Zelus' }]
}

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().min(1, 'Categoria obrigatória'),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export async function loader() {
  const categories = await listCategories()
  return { categories }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  if (effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  const formData = await request.formData()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  await createSupplier(orgId, parsed.data, user.id)
  return redirect(href('/suppliers'))
}

export default function NewSupplierPage({ loaderData, actionData }: Route.ComponentProps) {
  const { categories } = loaderData
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const categoryItems = categories.map((c) => ({ label: translateCategory(c.key), value: c.key }))

  return (
    <div className="mx-auto max-w-md">
      <BackButton to={href('/suppliers')} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Dados do fornecedor</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            {actionData?.error && <ErrorBanner>{actionData.error}</ErrorBanner>}

            <Field>
              <FieldLabel htmlFor="name">
                Nome <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="name" name="name" placeholder="Nome do fornecedor" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="category">
                Categoria <span className="text-destructive">*</span>
              </FieldLabel>
              <Select name="category" defaultValue="" items={categoryItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="phone">Telefone</FieldLabel>
              <Input id="phone" name="phone" type="tel" placeholder="+351 ..." />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" name="email" type="email" placeholder="email@exemplo.com" />
            </Field>

            <Field>
              <FieldLabel htmlFor="website">Website</FieldLabel>
              <Input id="website" name="website" placeholder="https://..." />
            </Field>

            <Field>
              <FieldLabel htmlFor="address">Morada</FieldLabel>
              <Input id="address" name="address" placeholder="Morada do fornecedor" />
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Observações sobre este fornecedor"
                rows={3}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button render={<Link to={href('/suppliers')} />} variant="outline">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A criar…' : 'Criar fornecedor'}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
