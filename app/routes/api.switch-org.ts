import { redirect, href } from 'react-router'

import type { Route } from './+types/api.switch-org'
import { auth } from '~/lib/auth/auth.server'
import { requireAuth } from '~/lib/auth/rbac'

export async function action({ request, context }: Route.ActionArgs) {
  requireAuth(context)

  const formData = await request.formData()
  const organizationId = formData.get('organizationId') as string

  if (!organizationId) {
    return Response.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const res = await auth.api.setActiveOrganization({
    body: { organizationId },
    asResponse: true,
    headers: request.headers,
  })

  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }

  throw redirect(href('/dashboard'), { headers })
}
