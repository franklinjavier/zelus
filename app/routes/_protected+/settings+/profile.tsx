import { useRef, useState } from 'react'
import { data, Form, href, useFetcher, useNavigation } from 'react-router'
import { Camera01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { z } from 'zod'

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { PhoneInput } from '~/components/shared/phone-input'
import { eq } from 'drizzle-orm'

import { auth } from '~/lib/auth/auth.server'
import { userContext } from '~/lib/auth/context'
import { db } from '~/lib/db'
import { user as userTable } from '~/lib/db/schema'
import { getInitials } from '~/lib/format'
import { validateForm } from '~/lib/forms'
import { setToast } from '~/lib/toast.server'
import type { Route } from './+types/profile'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional(),
})

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Perfil — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)
  const [row] = await db
    .select({ phone: userTable.phone })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1)
  return { user: { ...user, phone: row?.phone ?? '' } }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { id: userId } = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'update-avatar') {
    const imageUrl = formData.get('imageUrl')
    const res = await auth.api.updateUser({
      body: { image: imageUrl as string },
      asResponse: true,
      headers: request.headers,
    })
    if (!res.ok) {
      return data({ error: 'Não foi possível atualizar a foto.' }, { status: 400 })
    }
    return data({ success: true }, { headers: await setToast('Foto de perfil atualizada.') })
  }

  if (intent === 'remove-avatar') {
    const res = await auth.api.updateUser({
      body: { image: null },
      asResponse: true,
      headers: request.headers,
    })
    if (!res.ok) {
      return data({ error: 'Não foi possível remover a foto.' }, { status: 400 })
    }
    return data({ success: true }, { headers: await setToast('Foto de perfil removida.') })
  }

  const result = validateForm(formData, updateProfileSchema)

  if ('errors' in result) {
    return data({ errors: result.errors }, { status: 400 })
  }

  const phone = result.data.phone?.trim() || null
  await db.update(userTable).set({ phone }).where(eq(userTable.id, userId))

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

  const avatarFetcher = useFetcher()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const isAvatarBusy = isUploading || avatarFetcher.state !== 'idle'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(href('/api/upload'), { method: 'POST', body })
      const json = await res.json()

      if (!res.ok || !json.url) return

      avatarFetcher.submit({ intent: 'update-avatar', imageUrl: json.url }, { method: 'post' })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            className="group relative cursor-pointer rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAvatarBusy}
          >
            <Avatar className={`size-20 text-lg ${isAvatarBusy ? 'opacity-50' : ''}`}>
              {user.image && <AvatarImage src={user.image} alt={user.name} />}
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="bg-primary text-primary-foreground absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full ring-2 ring-white">
              <HugeiconsIcon icon={Camera01Icon} size={14} strokeWidth={2} />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {user.image && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
              disabled={isAvatarBusy}
              onClick={() => avatarFetcher.submit({ intent: 'remove-avatar' }, { method: 'post' })}
            >
              Remover
            </button>
          )}
        </div>

        <Form method="post" className="grid gap-4">
          <input type="hidden" name="intent" value="update-profile" />
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" name="name" defaultValue={user.name} required />
            {errors?.name && <FieldError>{errors.name}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" value={user.email} disabled />
          </Field>

          <Field>
            <FieldLabel htmlFor="phone">Telefone / WhatsApp</FieldLabel>
            <PhoneInput
              id="phone"
              name="phone"
              defaultValue={user.phone}
              placeholder="912 345 678"
            />
          </Field>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'A guardar…' : 'Guardar'}
          </Button>
        </Form>
      </CardContent>
    </Card>
  )
}
