import { useState } from 'react'
import { href, redirect, Form, useFetcher } from 'react-router'

import type { Route } from './+types/edit'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  deleteContact,
  linkContactToUser,
  listFractionContacts,
  listLinkableOrgMembers,
  unlinkContact,
  updateContact,
} from '~/lib/services/fraction-contacts.server'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '~/components/ui/drawer'
import { Field, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { ErrorBanner } from '~/components/layout/feedback'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { getInitials } from '~/lib/format'
import { setToast } from '~/lib/toast.server'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const contacts = await listFractionContacts(orgId, params.id)
  const contact = contacts.find((c) => c.id === params.contactId)
  if (!contact) throw new Response('Not Found', { status: 404 })

  const linkableMembers =
    contact.userId === null ? await listLinkableOrgMembers(orgId, params.id) : []

  return { contact, linkableMembers }
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

  if (intent === 'link') {
    const userId = formData.get('userId') as string
    if (!userId) return { error: 'Membro não especificado.' }

    try {
      await linkContactToUser(orgId, params.contactId, userId, user.id)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao ligar conta.' }
    }
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Conta ligada.'),
    })
  }

  if (intent === 'unlink') {
    try {
      await unlinkContact(orgId, params.contactId, user.id)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao desligar conta.' }
    }
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Conta desligada.'),
    })
  }

  return { error: 'Ação desconhecida.' }
}

export default function EditContactPage({ loaderData, actionData }: Route.ComponentProps) {
  const { contact, linkableMembers } = loaderData
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

        <div className="mt-6 border-t pt-6">
          <p className="mb-3 text-sm font-medium">Conta na plataforma</p>
          {contact.userId ? (
            <LinkedAccountRow
              name={contact.linkedUserName ?? ''}
              email={contact.linkedUserEmail ?? ''}
              image={contact.linkedUserImage}
            />
          ) : linkableMembers.length > 0 ? (
            <LinkAccountForm linkableMembers={linkableMembers} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum membro do condomínio disponível para ligar.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

function LinkedAccountRow({
  name,
  email,
  image,
}: {
  name: string
  email: string
  image: string | null
}) {
  return (
    <div className="ring-foreground/5 flex items-center gap-3 rounded-2xl p-3 ring-1">
      <Avatar className="size-8">
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-sm">{email}</p>
      </div>
      <Form method="post">
        <input type="hidden" name="intent" value="unlink" />
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground shrink-0">
          Desligar
        </Button>
      </Form>
    </div>
  )
}

function LinkAccountForm({
  linkableMembers,
}: {
  linkableMembers: { userId: string; userName: string; userEmail: string }[]
}) {
  const [selectedUserId, setSelectedUserId] = useState('')

  return (
    <Form method="post" className="flex flex-col gap-3">
      <input type="hidden" name="intent" value="link" />
      <input type="hidden" name="userId" value={selectedUserId} />
      <Select
        value={selectedUserId}
        items={linkableMembers.map((m) => ({ value: m.userId, label: m.userName }))}
        onValueChange={(v) => setSelectedUserId(v ?? '')}
      >
        <SelectTrigger>
          <SelectValue placeholder="Escolha um membro..." />
        </SelectTrigger>
        <SelectContent>
          {linkableMembers.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              <span className="flex flex-col">
                <span>{m.userName}</span>
                <span className="text-muted-foreground text-sm">{m.userEmail}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" variant="outline" disabled={!selectedUserId}>
        Ligar conta
      </Button>
    </Form>
  )
}
