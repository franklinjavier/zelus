import { data, href, redirect, Form, useFetcher } from 'react-router'

import type { Route } from './+types/edit'
import { orgContext, userContext } from '~/lib/auth/context'
import { getFraction, updateFraction, deleteFraction } from '~/lib/services/fractions'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const fraction = await getFraction(orgId, params.id)
  if (!fraction) throw new Response('Not Found', { status: 404 })

  return { fraction }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'update') {
    const label = formData.get('label') as string
    const description = formData.get('description') as string

    if (!label?.trim()) return { error: 'Nome obrigatório.' }

    try {
      await updateFraction(orgId, params.id, { label, description: description || null }, user.id)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao atualizar fração.' }
    }
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Alterações guardadas.'),
    })
  }

  if (intent === 'delete') {
    try {
      await deleteFraction(orgId, params.id, user.id)
      return redirect(href('/fractions'))
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar fração.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function EditFractionPage({ loaderData, actionData }: Route.ComponentProps) {
  const { fraction } = loaderData
  const fetcher = useFetcher()

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Editar fração</DrawerTitle>
        <DrawerDescription>Altere os dados da fração.</DrawerDescription>
      </DrawerHeader>
      <div className="px-6 pb-6">
        {actionData && 'error' in actionData && (
          <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
        )}
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
      </div>
    </>
  )
}
