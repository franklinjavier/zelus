import { redirect, useNavigation, Form, Link } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createRecord } from '~/lib/services/maintenance'
import { listSuppliers } from '~/lib/services/suppliers'
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
  return [{ title: 'Novo Registo de Manutenção — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const suppliers = await listSuppliers(orgId)
  return { suppliers }
}

const createSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().min(1, 'Descrição obrigatória'),
  supplierId: z.string().optional(),
  performedAt: z.string().min(1, 'Data obrigatória'),
  cost: z.string().optional(),
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
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  try {
    const record = await createRecord(
      orgId,
      {
        title: parsed.data.title,
        description: parsed.data.description,
        supplierId: parsed.data.supplierId || null,
        performedAt: new Date(parsed.data.performedAt),
        cost: parsed.data.cost || null,
      },
      user.id,
    )

    return redirect(`/maintenance/${record.id}`)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar registo.' }
  }
}

export default function NewMaintenancePage({ loaderData, actionData }: Route.ComponentProps) {
  const { suppliers } = loaderData
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const supplierItems = [
    { label: '— Nenhum —', value: '' },
    ...suppliers.map((s) => ({ label: s.name, value: s.id })),
  ]

  return (
    <div className="mx-auto max-w-md">
      <BackButton to="/maintenance" />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Dados do registo</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            {actionData?.error && <ErrorBanner>{actionData.error}</ErrorBanner>}

            <Field>
              <FieldLabel htmlFor="title">
                Título <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="title" name="title" placeholder="Resumo da manutenção" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">
                Descrição <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="description"
                name="description"
                placeholder="Descreva os trabalhos realizados"
                rows={4}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="supplierId">Fornecedor</FieldLabel>
              <Select name="supplierId" defaultValue="" items={supplierItems}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supplierItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="performedAt">
                Data <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="performedAt" name="performedAt" type="date" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="cost">Custo</FieldLabel>
              <Input id="cost" name="cost" type="number" step="0.01" min="0" placeholder="0.00" />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button render={<Link to="/maintenance" />} variant="outline">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A criar…' : 'Criar registo'}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
