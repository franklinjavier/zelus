import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'

import type { Route } from './+types/root'
import { sessionMiddleware } from '~/lib/auth/middleware'
import { getToast } from '~/lib/toast.server'
import { ErrorPage } from '~/components/brand/error-page'
import { Toaster } from '~/components/ui/sonner'
import { GlobalToast } from '~/components/layout/global-toast'
import { Agentation } from 'agentation'
import './app.css'

export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware]

export async function loader({ request }: Route.LoaderArgs) {
  const { toast, headers } = await getToast(request)
  return data({ toast }, { headers })
}

export const links: Route.LinksFunction = () => [
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <GlobalToast message={loaderData.toast} />
      <Outlet />
    </>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorPage
        title={error.status === 404 ? 'Página não encontrada' : 'Algo correu mal'}
        message={
          error.status === 404
            ? 'A página que procura não existe ou foi movida.'
            : error.statusText || 'Ocorreu um erro inesperado.'
        }
      />
    )
  }

  return (
    <ErrorPage
      title="Algo correu mal"
      message="Ocorreu um erro inesperado."
      stack={import.meta.env.DEV && error instanceof Error ? error.stack : undefined}
    />
  )
}
