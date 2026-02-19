# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Zelus is an internal condominium management system for residential condominiums in Portugal, built with React Router v7 in framework/SSR mode. See `docs/PRD.md` for full product requirements.

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run start        # Serve production build (react-router-serve)
bun run typecheck    # Generate route types + tsc
bun run test         # Run vitest tests
```

Add shadcn/ui components with `bunx shadcn@latest add [component-name]`.

## Database Migrations

All migration commands go through `scripts/db.ts`, a safety wrapper around Drizzle Kit.

```bash
bun run db:generate [name]   # Generate migration, scan for destructive ops
bun run db:migrate           # Preview + apply pending migrations (local DB only)
bun run db:check -- --all    # Scan all migrations for destructive ops (CI-friendly)
bun run db:status            # Show applied/pending migration state
bun run db:seed              # Seed demo data (local)
bun run db:studio            # Open Drizzle Studio (local)
```

The wrapper enforces:

- **Localhost guard**: `db:migrate` refuses non-local `DATABASE_URL` unless `--yes` is passed
- **Destructive op scanning**: `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE`, `TRUNCATE`, `DELETE FROM` are errors that block migration; `DROP INDEX`, `RENAME TABLE/COLUMN`, `DROP CONSTRAINT` are warnings
- **Preview before apply**: pending SQL is printed with highlighted issues before confirmation
- **CI check gate**: `db:check` exits with code 1 if destructive operations are found
- **Reviewed ops allowlist**: Add reviewed destructive operations to `app/lib/db/migrations/meta/_reviewed.json` to downgrade them from errors to warnings (keyed by filename and line number)

For staging/production deployments, use `db:migrate:staging` or `db:migrate:prod` (these pass `--yes`).

Do **not** use `drizzle-kit push` — use the generate + migrate workflow instead.

## Troubleshooting

If `react-router typegen` gets stuck or fails with esbuild errors, remove `node_modules` and reinstall:

```bash
rm -rf node_modules && bun install
```

## Architecture

- **React Router v7** framework mode with SSR (`react-router.config.ts`)
- **Type-safe routing** via generated `+types/route-name` imports
- **Path alias**: `~/` maps to `./app/`
- **Remix flat routes** convention via `remix-flat-routes` (see `app/routes.ts`)
  - `+` suffix = folder route, `_` prefix = pathless layout, `$param` = dynamic segment
  - `_layout.tsx` = layout component, `_modules/` = non-route files

### Route Modules

Each route file can export: `default` (component), `meta`, `loader`, `action`, `ErrorBoundary`. Types from `+types/route-name`.

## Component Organization

```
app/components/
├── ui/           # shadcn/ui primitives — managed by `bunx shadcn`, don't manually edit
├── auth/         # Auth-related components (GoogleIcon)
├── brand/        # Logo, azulejo pattern, CardLink — brand identity components
├── layout/       # App shell, sidebar, header, BackButton, EmptyState, feedback banners
├── shared/       # Cross-feature components (RoleBadge, DeleteConfirmDialog)
└── [feature]/    # Feature-specific shared components
```

- **No loose files** in `components/` root — everything in a subfolder
- **`ui/`** is shadcn-managed — do not manually create files there
- Route-specific components stay colocated in `app/routes/`

### Shared Utilities (`app/lib/`)

- **`format.ts`** — Date/currency/initials formatting (`formatDate`, `formatShortDate`, `toInputDate`, `formatCost`, `getInitials`)
- **`forms.ts`** — Zod-based `validateForm` helper for route actions
- **`use-filter-params.ts`** — Hook for URL search param filters on list pages

### Route Paths

**Always use `href()` from `react-router`** instead of hardcoded path strings. This gives compile-time validation that the route exists.

```tsx
import { href } from 'react-router'

// Static routes
href('/dashboard')
href('/tickets')

// Dynamic routes — params are type-checked
href('/tickets/:id', { id: ticketId })
href('/invite/:token', { token })
```

Use `href()` everywhere: `redirect()`, `<Link to>`, `navigate()`, `action` props, etc.

## UI & Styling

**Read `.interface-design/system.md` before making any UI changes.** It documents the full design system: palette, typography, spacing, radius, sizing, accessibility rules, and brand components.

Key facts:

- **shadcn/ui `base-maia`** style + **@base-ui/react** headless primitives
- **Tailwind CSS v4** with OKLCH color variables in `app/app.css`
- **Icons**: `@hugeicons/react` + `@hugeicons/core-free-icons`
- **Target audience**: elderly, non-technical users — h-10 buttons/inputs, no text-xs, 4.5:1+ contrast

## Testing

- **Vitest** with happy-dom environment (`vitest.config.ts`)
- Test files go in `__tests__/` folders next to the code they test (e.g. `app/lib/__tests__/format.test.ts`)
- CI runs typecheck + tests on PRs and pushes to main (`.github/workflows/ci.yml`)

## Code Style

Prettier: no semicolons, single quotes, trailing commas, print width 100. Pre-commit hook runs `pretty-quick --staged`.

**No barrel files (index.ts re-exports).** Always import directly from the source file, never through an index.ts that re-exports. The only exception is `app/lib/db/schema/index.ts` which Drizzle Kit requires as a single schema entry point.

## Git

- Do not include `Co-Authored-By` or `Generated with Claude` in commit messages
