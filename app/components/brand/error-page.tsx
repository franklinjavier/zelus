import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'

type ErrorProps = {
  status?: number
  title: string
  message: string
  stack?: string
  /**
   * Where the primary recovery button should take the user.
   * Defaults to public home.
   */
  homeHref?: string
}

export function ErrorContent({ status, title, message, stack, homeHref = '/' }: ErrorProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="max-w-md text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <ZelusLogoTile size={56} className="text-primary" />
          {status && (
            <span className="text-muted-foreground text-3xl font-semibold tracking-tighter">
              {status}
            </span>
          )}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2">{message}</p>
        <div className="mt-8">
          <a
            href={homeHref}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-full px-6 text-sm font-medium"
            onClick={(e) => {
              // Some router/error-boundary states can swallow client-side navigation.
              // Force a hard navigation to guarantee the user can recover.
              e.preventDefault()
              window.location.assign(homeHref)
            }}
          >
            Voltar ao início
          </a>
        </div>
        {stack && (
          <pre className="text-muted-foreground mt-8 max-h-64 overflow-auto rounded-xl border p-4 text-left text-xs">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </div>
  )
}

export function ErrorPage(props: ErrorProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="relative flex flex-1 flex-col">
        <AzulejoPattern />
        <ErrorContent {...props} />
      </main>
    </div>
  )
}
