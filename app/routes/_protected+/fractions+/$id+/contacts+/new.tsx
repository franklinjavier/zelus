import { href, redirect, Form } from 'react-router'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createContact } from '~/lib/services/fraction-contacts'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldLabel } from '~/components/ui/field'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'

export async function loader({ context }: Route.LoaderArgs) {
  const { effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })
  return {}
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const name = (formData.get('name') as string)?.trim()
  const nif = (formData.get('nif') as string) || null
  const mobile = (formData.get('mobile') as string) || null
  const phone = (formData.get('phone') as string) || null
  const email = (formData.get('email') as string) || null
  const notes = (formData.get('notes') as string) || null

  if (!name) return { error: 'Nome obrigatório.' }

  try {
    await createContact(
      orgId,
      params.id,
      {
        name,
        nif: nif || null,
        mobile: mobile || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      },
      user.id,
    )
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Contacto adicionado.'),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar contacto.' }
  }
}

export default function NewContactPage({ actionData }: Route.ComponentProps) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Adicionar contacto</DrawerTitle>
        <DrawerDescription>Registe os dados de um residente.</DrawerDescription>
      </DrawerHeader>
      <div className="px-6 pb-6">
        {actionData && 'error' in actionData && (
          <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
        )}
        <Form method="post" className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="contact-name">Nome *</FieldLabel>
            <Input id="contact-name" name="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-email">E-mail</FieldLabel>
            <Input id="contact-email" name="email" type="email" />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-mobile">Telemóvel</FieldLabel>
            <Input id="contact-mobile" name="mobile" type="tel" />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-phone">Telefone</FieldLabel>
            <Input id="contact-phone" name="phone" type="tel" />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-nif">NIF</FieldLabel>
            <Input id="contact-nif" name="nif" />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-notes">Notas</FieldLabel>
            <Textarea id="contact-notes" name="notes" rows={3} />
          </Field>
          <Button type="submit" className="mt-1">
            Adicionar contacto
          </Button>
        </Form>
      </div>
    </>
  )
}
