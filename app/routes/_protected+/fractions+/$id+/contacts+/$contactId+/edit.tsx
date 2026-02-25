import { href, redirect, Form, useFetcher } from 'react-router'

import type { Route } from './+types/edit'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  listFractionContacts,
  updateContact,
  deleteContact,
} from '~/lib/services/fraction-contacts'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldLabel } from '~/components/ui/field'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { setToast } from '~/lib/toast.server'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const contacts = await listFractionContacts(orgId, params.id)
  const contact = contacts.find((c) => c.id === params.contactId)
  if (!contact) throw new Response('Not Found', { status: 404 })

  return { contact }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'update') {
    const name = (formData.get('name') as string)?.trim()
    const nif = (formData.get('nif') as string) || null
    const mobile = (formData.get('mobile') as string) || null
    const phone = (formData.get('phone') as string) || null
    const email = (formData.get('email') as string) || null
    const notes = (formData.get('notes') as string) || null

    if (!name) return { error: 'Nome obrigatório.' }

    try {
      await updateContact(
        orgId,
        params.contactId,
        { name, nif, mobile, phone, email, notes },
        user.id,
      )
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao atualizar contacto.' }
    }
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Contacto actualizado.'),
    })
  }

  if (intent === 'delete') {
    try {
      await deleteContact(orgId, params.contactId, user.id)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar contacto.' }
    }
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Contacto apagado.'),
    })
  }

  return { error: 'Ação desconhecida.' }
}

export default function EditContactPage({ loaderData, actionData }: Route.ComponentProps) {
  const { contact } = loaderData
  const fetcher = useFetcher()

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Editar contacto</DrawerTitle>
        <DrawerDescription>Altere os dados do contacto.</DrawerDescription>
      </DrawerHeader>
      <div className="px-6 pb-6">
        {actionData && 'error' in actionData && (
          <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
        )}
        <Form method="post" className="grid gap-4">
          <input type="hidden" name="intent" value="update" />
          <Field>
            <FieldLabel htmlFor="contact-name">Nome *</FieldLabel>
            <Input id="contact-name" name="name" required defaultValue={contact.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-email">E-mail</FieldLabel>
            <Input
              id="contact-email"
              name="email"
              type="email"
              defaultValue={contact.email ?? ''}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-mobile">Telemóvel</FieldLabel>
            <Input
              id="contact-mobile"
              name="mobile"
              type="tel"
              defaultValue={contact.mobile ?? ''}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-phone">Telefone</FieldLabel>
            <Input id="contact-phone" name="phone" type="tel" defaultValue={contact.phone ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-nif">NIF</FieldLabel>
            <Input id="contact-nif" name="nif" defaultValue={contact.nif ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-notes">Notas</FieldLabel>
            <Textarea id="contact-notes" name="notes" rows={3} defaultValue={contact.notes ?? ''} />
          </Field>
          <div className="flex items-center justify-between pt-2">
            <DeleteConfirmDialog
              title="Apagar contacto?"
              description="Esta ação não pode ser revertida."
            >
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <AlertDialogAction type="submit">Apagar</AlertDialogAction>
              </fetcher.Form>
            </DeleteConfirmDialog>
            <Button type="submit">Guardar</Button>
          </div>
        </Form>
      </div>
    </>
  )
}
