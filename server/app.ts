import { waitUntil } from '@vercel/functions'
import * as build from 'virtual:react-router/server-build'
import { createRequestHandler, RouterContextProvider } from 'react-router'

import { waitUntilContext } from '~/lib/vercel/context'

const handler = createRequestHandler(build)

export default (req: Request) => {
  const ctx = new RouterContextProvider()
  ctx.set(waitUntilContext, waitUntil)
  return handler(req, ctx)
}
