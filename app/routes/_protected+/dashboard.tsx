import { href, redirect } from 'react-router'

import type { Route } from './+types/dashboard'

export async function loader(_args: Route.LoaderArgs) {
  throw redirect(href('/home'))
}
