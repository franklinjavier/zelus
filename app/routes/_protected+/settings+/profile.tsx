import { data, Form, useNavigation } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/profile'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { auth } from '~/lib/auth/auth.server'
import { userContext } from '~/lib/auth/context'
import { validateForm } from '~/lib/forms'
import { setToast } from '~/lib/toast.server'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Perfil — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)
  return { user }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const result = validateForm(formData, updateProfileSchema)

  if ('errors' in result) {
    return data({ errors: result.errors }, { status: 400 })
  }

  const res = await auth.api.updateUser({
    body: { name: result.data.name },
    asResponse: true,
    headers: request.headers,
  })

  if (!res.ok) {
    return data({ error: 'Não foi possível atualizar o perfil.' }, { status: 400 })
  }

  return data({ success: true }, { headers: await setToast('Perfil atualizado.') })
}

export default function ProfilePage({ loaderData, actionData }: Route.ComponentProps) {
  const { user } = loaderData
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const errors = actionData && 'errors' in actionData ? actionData.errors : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="post" className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" name="name" defaultValue={user.name} required />
            {errors?.name && <FieldError>{errors.name}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" value={user.email} disabled />
          </Field>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'A guardar…' : 'Guardar'}
          </Button>
        </Form>
      </CardContent>
    </Card>
  )
}
