import { data, Form } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/invites'
import { orgContext, userContext } from '~/lib/auth/context'
import { listInvites, createOrgInvite, createFractionInvite } from '~/lib/services/invites'
import { listFractions } from '~/lib/services/fractions'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { roleLabel } from '~/components/shared/role-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Convites — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const [invitesList, fractionsList] = await Promise.all([listInvites(orgId), listFractions(orgId)])

  return { invites: invitesList, fractions: fractionsList }
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
      return data({ success: true }, { headers: await setToast('Convite criado.') })
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
      return data({ success: true }, { headers: await setToast('Convite criado.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao criar convite.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function InvitesPage({ loaderData, actionData }: Route.ComponentProps) {
  const { invites, fractions } = loaderData

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Convites</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* Create Invite */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Novo convite</CardTitle>
            </CardHeader>
            <CardContent>
              {actionData && 'error' in actionData && (
                <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
              )}

              <InviteForm fractions={fractions} />
            </CardContent>
          </Card>
        </div>

        {/* Existing Invites */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Convites enviados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invites.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  Nenhum convite enviado.
                </p>
              ) : (
                <div className="divide-y">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{invite.email}</p>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
                          <span>
                            {invite.type === 'org'
                              ? 'Organização'
                              : (invite.fractionLabel ?? 'Fração')}
                          </span>
                          <span>&middot;</span>
                          <span>{roleLabel(invite.role)}</span>
                        </div>
                      </div>
                      <StatusBadge status={invite.status} />
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

const intentItems = [
  { label: 'Organização', value: 'create-org-invite' },
  { label: 'Fração', value: 'create-fraction-invite' },
]

const roleItems = [
  { label: 'Membro', value: 'fraction_member' },
  { label: 'Admin organização', value: 'org_admin' },
  { label: 'Admin fração', value: 'fraction_owner_admin' },
]

function InviteForm({ fractions }: { fractions: { id: string; label: string }[] }) {
  const fractionItems = [
    { label: '— Selecionar —', value: '' },
    ...fractions.map((f) => ({ label: f.label, value: f.id })),
  ]

  return (
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

      <Button type="submit" className="mt-1">
        Criar convite
      </Button>
    </Form>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') return <Badge variant="default">Aceite</Badge>
  if (status === 'pending') return <Badge variant="secondary">Pendente</Badge>
  return <Badge variant="destructive">Expirado</Badge>
}
