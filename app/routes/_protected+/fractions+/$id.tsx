import { data, href, redirect, Form, useFetcher } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserAdd01Icon, UserMultiple02Icon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import { getFractionRole } from '~/lib/auth/rbac'
import { getFraction, updateFraction, deleteFraction } from '~/lib/services/fractions'
import { listFractionMembers } from '~/lib/services/associations'
import { createFractionInvite } from '~/lib/services/invites'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { getInitials } from '~/lib/format'
import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { RoleBadge } from '~/components/shared/role-badge'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.fraction?.label ?? 'Fração'
  return [{ title: `${label} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const fraction = await getFraction(orgId, params.id)

  if (!fraction) throw new Response('Not Found', { status: 404 })

  const isAdmin = effectiveRole === 'org_admin'
  const fractionRole = isAdmin ? null : await getFractionRole(orgId, user.id, params.id)

  if (!isAdmin && !fractionRole) {
    throw new Response('Forbidden', { status: 403 })
  }

  const members = await listFractionMembers(orgId, params.id)
  const canInvite = isAdmin || fractionRole === 'fraction_owner_admin'

  return { fraction, members, isAdmin, canInvite }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'update') {
    if (effectiveRole !== 'org_admin') {
      throw new Response('Forbidden', { status: 403 })
    }

    const label = formData.get('label') as string
    const description = formData.get('description') as string

    if (!label?.trim()) return { error: 'Nome obrigatório.' }

    await updateFraction(orgId, params.id, { label, description: description || null }, user.id)
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'delete') {
    if (effectiveRole !== 'org_admin') {
      throw new Response('Forbidden', { status: 403 })
    }

    try {
      await deleteFraction(orgId, params.id, user.id)
      return redirect(href('/fractions'))
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar fração.' }
    }
  }

  if (intent === 'invite-member') {
    const isAdmin = effectiveRole === 'org_admin'
    const fractionRole = isAdmin ? null : await getFractionRole(orgId, user.id, params.id)
    const canInvite = isAdmin || fractionRole === 'fraction_owner_admin'

    if (!canInvite) throw new Response('Forbidden', { status: 403 })

    const email = formData.get('email') as string
    const role = (formData.get('role') as string) || 'fraction_member'

    if (!email?.trim()) return { error: 'E-mail obrigatório.' }
    if (role !== 'fraction_owner_admin' && role !== 'fraction_member') {
      return { error: 'Papel inválido.' }
    }

    try {
      await createFractionInvite(orgId, params.id, email, role, user.id)
      return data({ success: true }, { headers: await setToast('Convite enviado.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao enviar convite.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function FractionDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { fraction, members, isAdmin, canInvite } = loaderData
  const fetcher = useFetcher()
  const hasLeftColumn = isAdmin || canInvite

  return (
    <div>
      <BackButton to={href('/fractions')} />

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      {hasLeftColumn && (
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {/* Left column: Info/Edit + Invite */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Dados da fração</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form method="post" className="grid gap-4">
                    <input type="hidden" name="intent" value="update" />
                    <Field>
                      <FieldLabel htmlFor="label">Nome</FieldLabel>
                      <Input id="label" name="label" defaultValue={fraction.label} required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="description">Descrição</FieldLabel>
                      <Textarea
                        id="description"
                        name="description"
                        defaultValue={fraction.description ?? ''}
                        rows={3}
                      />
                    </Field>
                    <div className="flex items-center justify-between pt-2">
                      <DeleteConfirmDialog
                        title="Apagar fração?"
                        description="Esta ação não pode ser revertida. Todos os dados da fração serão apagados."
                      >
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <AlertDialogAction type="submit">Apagar</AlertDialogAction>
                        </fetcher.Form>
                      </DeleteConfirmDialog>
                      <Button type="submit">Guardar</Button>
                    </div>
                  </Form>
                </CardContent>
              </Card>
            )}

            {canInvite && (
              <Card>
                <CardHeader>
                  <CardTitle>Convidar membro</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form method="post" className="grid gap-4">
                    <input type="hidden" name="intent" value="invite-member" />
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
                    <FractionRoleSelect />
                    <Button type="submit">
                      <HugeiconsIcon
                        icon={UserAdd01Icon}
                        data-icon="inline-start"
                        size={16}
                        strokeWidth={2}
                      />
                      Enviar convite
                    </Button>
                  </Form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: Members */}
          <div className="lg:col-span-3">
            <MembersCard members={members} />
          </div>
        </div>
      )}

      {!hasLeftColumn && (
        <div className="mt-6">
          <MembersCard members={members} />
        </div>
      )}
    </div>
  )
}

function MembersCard({
  members,
}: {
  members: { id: string; userName: string; userEmail: string; role: string; status: string }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Membros
          <span className="text-muted-foreground ml-2 text-sm font-normal">{members.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="bg-muted flex size-12 items-center justify-center rounded-2xl">
              <HugeiconsIcon
                icon={UserMultiple02Icon}
                size={20}
                strokeWidth={1.5}
                className="text-muted-foreground"
              />
            </div>
            <p className="text-muted-foreground text-sm">Nenhum membro associado</p>
          </div>
        ) : (
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <MemberAvatar name={m.userName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.userName}</p>
                  <p className="text-muted-foreground truncate text-sm">{m.userEmail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleBadge role={m.role} />
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MemberAvatar({ name }: { name: string }) {
  return (
    <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
      {getInitials(name)}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return null
  if (status === 'pending') return <Badge variant="secondary">Pendente</Badge>
  return <Badge variant="destructive">Rejeitado</Badge>
}

const fractionRoleItems = [
  { label: 'Membro', value: 'fraction_member' },
  { label: 'Admin da fração', value: 'fraction_owner_admin' },
]

function FractionRoleSelect() {
  return (
    <Field>
      <FieldLabel htmlFor="invite-role">Papel</FieldLabel>
      <Select name="role" defaultValue="fraction_member" items={fractionRoleItems}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fractionRoleItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
