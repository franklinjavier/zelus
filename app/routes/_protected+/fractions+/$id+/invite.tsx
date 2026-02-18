import { href, redirect, Form } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserAdd01Icon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/invite'
import { orgContext, userContext } from '~/lib/auth/context'
import { getFractionRole } from '~/lib/auth/rbac'
import { createFractionInvite } from '~/lib/services/invites'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const isAdmin = effectiveRole === 'org_admin'
  const fractionRole = isAdmin ? null : await getFractionRole(orgId, user.id, params.id)
  const canInvite = isAdmin || fractionRole === 'fraction_owner_admin'

  if (!canInvite) throw new Response('Forbidden', { status: 403 })

  return {}
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const isAdmin = effectiveRole === 'org_admin'
  const fractionRole = isAdmin ? null : await getFractionRole(orgId, user.id, params.id)
  const canInvite = isAdmin || fractionRole === 'fraction_owner_admin'

  if (!canInvite) throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const email = formData.get('email') as string
  const role = (formData.get('role') as string) || 'fraction_member'

  if (!email?.trim()) return { error: 'E-mail obrigatório.' }
  if (role !== 'fraction_owner_admin' && role !== 'fraction_member') {
    return { error: 'Papel inválido.' }
  }

  try {
    await createFractionInvite(orgId, params.id, email, role, user.id)
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Convite enviado.'),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao enviar convite.' }
  }
}

const fractionRoleItems = [
  { label: 'Membro', value: 'fraction_member' },
  { label: 'Admin da fração', value: 'fraction_owner_admin' },
]

export default function InviteMemberPage({ actionData }: Route.ComponentProps) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Convidar membro</DrawerTitle>
        <DrawerDescription>Envie um convite por e-mail.</DrawerDescription>
      </DrawerHeader>
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
          <Button type="submit" className="mt-1">
            <HugeiconsIcon
              icon={UserAdd01Icon}
              data-icon="inline-start"
              size={16}
              strokeWidth={2}
            />
            Enviar convite
          </Button>
        </Form>
      </div>
    </>
  )
}
