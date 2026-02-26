import { href, Outlet, redirect } from 'react-router'

import type { Route } from './+types/_layout'
import { sessionContext } from '~/lib/auth/context'
import { getSafeRedirect } from '~/lib/misc/safe-redirect'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  if (session) {
    throw redirect(getSafeRedirect(request, href('/home')))
  }
  return null
}

export default function AuthLayout() {
  return <Outlet />
}
