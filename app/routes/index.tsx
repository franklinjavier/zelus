import { href } from 'react-router'

import type { Route } from './+types'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Zelus — Gestão de Condomínios' },
    { name: 'description', content: 'Sistema interno de gestão para condomínios residenciais.' },
  ]
}

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="relative flex flex-1 items-center justify-center px-6">
        <AzulejoPattern />
        <div className="relative z-10 max-w-lg text-center">
          <div className="mb-6 flex flex-col items-center gap-3">
            <ZelusLogoTile size={64} className="text-primary" />
            <span className="text-3xl font-semibold tracking-tight">zelus</span>
          </div>
          <p className="text-muted-foreground text-lg font-semibold">
            Gestão de condomínios, simplificada.
          </p>
          <p className="text-muted-foreground mt-3">
            Centralize ocorrências, intervenções e prestadores num único lugar. Sem ruído, sem
            complicações.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a
              href={href('/login')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-full px-5 text-sm font-medium"
            >
              Começar
            </a>
          </div>
        </div>
      </main>

      <footer className="bg-background/80 text-muted-foreground relative z-10 border-t px-6 py-4 text-center text-sm backdrop-blur-sm">
        Zelus &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
