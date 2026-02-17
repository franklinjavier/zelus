import { data, Form, redirect, href } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createOrgInvite, createFractionInvite } from '~/lib/services/invites'
import { listFractions } from '~/lib/services/fractions'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const fractionsList = await listFractions(orgId)
  return { fractions: fractionsList }
}

const orgInviteSchema = z.object({
  intent: z.literal('create-org-invite'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['org_admin', 'fraction_member']),
})

const fractionInviteSchema = z.object({
  intent: z.literal('create-fraction-invite'),
  email: z.string().email('E-mail inválido'),
  fractionId: z.string().min(1),
  role: z.enum(['fraction_owner_admin', 'fraction_member']),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  if (fields.intent === 'create-org-invite') {
    const parsed = orgInviteSchema.safeParse(fields)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    try {
      await createOrgInvite(orgId, parsed.data.email, parsed.data.role, user.id)
      return redirect(href('/admin/invites'), { headers: await setToast('Convite criado.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao criar convite.' }
    }
  }

  if (fields.intent === 'create-fraction-invite') {
    const parsed = fractionInviteSchema.safeParse(fields)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    try {
      await createFractionInvite(
        orgId,
        parsed.data.fractionId,
        parsed.data.email,
        parsed.data.role,
        user.id,
      )
      return redirect(href('/admin/invites'), { headers: await setToast('Convite criado.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao criar convite.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

const intentItems = [
  { label: 'Condomínio', value: 'create-org-invite' },
  { label: 'Fração', value: 'create-fraction-invite' },
]

const roleItems = [
  { label: 'Membro', value: 'fraction_member' },
  { label: 'Admin condomínio', value: 'org_admin' },
  { label: 'Admin fração', value: 'fraction_owner_admin' },
]

export default function NewInvitePage({ loaderData, actionData }: Route.ComponentProps) {
  const { fractions } = loaderData

  const fractionItems = [
    { label: '— Selecionar —', value: '' },
    ...fractions.map((f) => ({ label: f.label, value: f.id })),
  ]

  return (
    <div className="px-6 pb-6">
      {actionData && 'error' in actionData && (
        <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
      )}

      <Form method="post" className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="email@exemplo.com"
            required
          />
        </Field>

        <Field>
          <FieldLabel>Tipo</FieldLabel>
          <Select name="intent" defaultValue="create-org-invite" items={intentItems}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intentItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Fração</FieldLabel>
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
          <FieldLabel>Papel</FieldLabel>
          <Select name="role" defaultValue="fraction_member" items={roleItems}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Button type="submit" size="lg" className="mt-1">
          Criar convite
        </Button>
      </Form>
    </div>
  )
}
