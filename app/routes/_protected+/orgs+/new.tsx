import { data, href, useNavigation, Form } from 'react-router'

import type { Route } from './+types/new'
import { requireAuth } from '~/lib/auth/rbac'
import { redirectWithCookies, validateForm } from '~/lib/forms'
import { createOrgSchema, createOrganization } from '~/lib/services/organizations'

import { ErrorBanner } from '~/components/layout/feedback'
import { OrgFormFields } from '~/components/shared/org-form-fields'
import { Button } from '~/components/ui/button'

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

  return redirectWithCookies(res, href('/orgs'))
}

export default function NewOrgPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const serverError = actionData && 'error' in actionData ? (actionData.error as string) : null
  const fieldErrors =
    actionData && 'errors' in actionData ? (actionData.errors as Record<string, string>) : null

  return (
    <div className="px-6 pb-6">
      <Form method="post" className="grid gap-4">
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

        <OrgFormFields fieldErrors={fieldErrors} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'A criar…' : 'Criar condomínio'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
