import { href, redirect } from 'react-router'

import type { Route } from './+types/auth.signout'
import { auth } from '~/lib/auth/auth.server'

export async function action({ request }: Route.ActionArgs) {
  const res = await auth.api.signOut({
    asResponse: true,
    headers: request.headers,
  })

  const headers = new Headers()
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }

  return redirect(href('/login'), { headers })
}
