import { data, useFetcher, href } from 'react-router'

import type { Route } from './+types/org'
import { requireAuth } from '~/lib/auth/rbac'
import { redirectWithCookies, validateForm } from '~/lib/forms'
import { createOrgSchema, createOrganization } from '~/lib/services/organizations.server'

import { ErrorBanner } from '~/components/layout/feedback'
import { OrgFormFields } from '~/components/shared/org-form-fields'
import { Button } from '~/components/ui/button'

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

  const orgData = await res.json()
  throw redirectWithCookies(res, `${href('/onboarding/fractions')}?orgId=${orgData.id}`)
}

export default function OnboardingOrg() {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state === 'submitting'

  const serverError =
    fetcher.data && 'error' in fetcher.data ? (fetcher.data.error as string) : null
  const fieldErrors =
    fetcher.data && 'errors' in fetcher.data
      ? (fetcher.data.errors as Record<string, string>)
      : null

  return (
    <>
      {serverError && <ErrorBanner className="mb-4">{serverError}</ErrorBanner>}
      <fetcher.Form method="post" className="grid gap-4">
        <OrgFormFields fieldErrors={fieldErrors} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'A criar…' : 'Continuar'}
        </Button>
      </fetcher.Form>
    </>
  )
}
