import { href, Outlet, redirect } from 'react-router'

import type { Route } from './+types/_layout'
import { sessionContext } from '~/lib/auth/context'

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  if (session) {
    throw redirect(href('/dashboard'))
  }
  return null
}

export default function AuthLayout() {
  return <Outlet />
}
