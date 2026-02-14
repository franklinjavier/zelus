import { href, redirect, useNavigation, Form } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createTicket } from '~/lib/services/tickets'
import { listCategories } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { listFractions } from '~/lib/services/fractions'
import { Button } from '~/components/ui/button'
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
import { PrioritySelector } from '~/components/tickets/priority-indicator'
import { Checkbox } from '~/components/ui/checkbox'
import { ErrorBanner } from '~/components/layout/feedback'

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)

  const [categories, fractions] = await Promise.all([listCategories(), listFractions(orgId)])

  return { categories, fractions }
}

const createSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().min(1, 'Descrição obrigatória'),
  category: z.string().optional(),
  fractionId: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  private: z.literal('on').optional(),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)

  const formData = await request.formData()
  const raw = Object.fromEntries(formData)
  const parsed = createSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  try {
    const ticket = await createTicket(
      orgId,
      {
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category || null,
        fractionId: parsed.data.fractionId || null,
        priority: parsed.data.priority ?? null,
        private: parsed.data.private === 'on',
      },
      user.id,
    )

    return redirect(href('/tickets/:id', { id: ticket.id }))
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar ocorrência.' }
  }
}

export default function NewTicketDrawer({ loaderData, actionData }: Route.ComponentProps) {
  const { categories, fractions } = loaderData
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const categoryItems = [
    { label: '— Selecionar —', value: '' },
    ...categories.map((c) => ({ label: translateCategory(c.key), value: c.key })),
  ]

  const fractionItems = [
    { label: '— Nenhuma —', value: '' },
    ...fractions.map((f) => ({ label: f.label, value: f.id })),
  ]

  return (
    <div className="px-6 pb-6">
      {actionData?.error && <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>}

      <Form method="post" className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="title">Título</FieldLabel>
          <Input id="title" name="title" placeholder="Resumo da ocorrência" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <Textarea
            id="description"
            name="description"
            placeholder="Descreva a ocorrência em detalhe"
            rows={4}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="categoryId">Categoria</FieldLabel>
          <Select name="category" defaultValue="" items={categoryItems}>
            <SelectTrigger className="w-full">
              <SelectValue />
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
          <FieldLabel htmlFor="fractionId">Fração</FieldLabel>
          <Select name="fractionId" defaultValue="" items={fractionItems}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fractionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Prioridade</FieldLabel>
          <PrioritySelector name="priority" />
        </Field>

        <label className="flex items-center gap-2">
          <Checkbox name="private" />
          <span className="text-sm">Marcar como privado</span>
        </label>

        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? 'A criar…' : 'Criar ocorrência'}
        </Button>
      </Form>
    </div>
  )
}
