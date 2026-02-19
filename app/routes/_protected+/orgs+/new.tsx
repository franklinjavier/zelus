import { data, href, Link, useNavigation, Form } from 'react-router'

import type { Route } from './+types/new'
import { requireAuth } from '~/lib/auth/rbac'
import { redirectWithCookies, validateForm } from '~/lib/forms'
import { createOrgSchema, createOrganization } from '~/lib/services/organizations'

import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { OrgFormFields } from '~/components/shared/org-form-fields'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export function meta() {
  return [{ title: 'Criar Condomínio — Zelus' }]
}

export async function action({ request, context }: Route.ActionArgs) {
  requireAuth(context)
  const formData = await request.formData()

  const result = validateForm(formData, createOrgSchema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const res = await createOrganization(result.data, request.headers)

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    return data({ error: errData?.message || 'Erro ao criar condomínio.' }, { status: 500 })
  }

  return redirectWithCookies(res, href('/dashboard'))
}

export default function NewOrgPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const serverError = actionData && 'error' in actionData ? (actionData.error as string) : null
  const fieldErrors =
    actionData && 'errors' in actionData ? (actionData.errors as Record<string, string>) : null

  return (
    <div className="mx-auto max-w-md">
      <BackButton to={href('/dashboard')} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Novo condomínio</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

            <OrgFormFields fieldErrors={fieldErrors} />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                nativeButton={false}
                render={<Link to={href('/dashboard')} />}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'A criar…' : 'Criar condomínio'}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
