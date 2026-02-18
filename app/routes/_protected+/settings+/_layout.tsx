import { href, Link, Outlet, useLocation } from 'react-router'

import type { Route } from './+types/_layout'
import { cn } from '~/lib/utils'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Definições — Zelus' }]
}

const tabs = [
  { label: 'Perfil', href: href('/settings/profile') },
  { label: 'Conta', href: href('/settings/account') },
]

export default function SettingsLayout() {
  const { pathname } = useLocation()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Definições</h1>
        <p className="text-muted-foreground text-sm">Perfil, segurança e gestão de conta.</p>
      </header>

      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(tab.href)
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
