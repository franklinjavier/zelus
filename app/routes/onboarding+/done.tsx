import { redirect, useFetcher, useSearchParams } from 'react-router'

import type { Route } from './+types/done'
import { requireAuth } from '~/lib/auth/rbac'
import { auth } from '~/lib/auth/auth.server'

import { Button } from '~/components/ui/button'

function forwardCookies(res: Response): Headers {
  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const orgId = url.searchParams.get('orgId')
  if (!orgId) throw redirect('/onboarding/org')
  return { orgId }
}

export async function action({ request, context }: Route.ActionArgs) {
  requireAuth(context)
  const formData = await request.formData()
  const orgId = formData.get('orgId') as string

  if (!orgId) throw redirect('/onboarding/org')

  const res = await auth.api.setActiveOrganization({
    body: { organizationId: orgId },
    asResponse: true,
    headers: request.headers,
  })

  throw redirect('/dashboard', { headers: forwardCookies(res) })
}

export default function OnboardingDone() {
  const [searchParams] = useSearchParams()
  const orgId = searchParams.get('orgId')!
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state === 'submitting'

  return (
    <div className="grid gap-4 text-center">
      <p className="text-muted-foreground text-sm">
        O seu condomínio está configurado. Pode convidar administradores adicionais mais tarde nas
        definições.
      </p>
      <fetcher.Form method="post">
        <input type="hidden" name="orgId" value={orgId} />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'A entrar…' : 'Ir para o painel'}
        </Button>
      </fetcher.Form>
    </div>
  )
}
