# Extract Duplicated Code into Shared Utilities and Components

After standardizing forms on React Router and fixing meta/filter anti-patterns, the codebase had significant code duplication across route files: identical formatting functions, repeated UI patterns (banners, back buttons, empty states, delete dialogs), and duplicated filter logic. Extracting these into shared modules reduces maintenance burden and ensures consistency.

---

## New files

### 1. `app/lib/format.ts` — Formatting utilities

- `formatCost(cost: string | null): string | null` — EUR currency formatting
- `formatDate(date: Date | string): string` — long format (e.g. "15 de março de 2024")
- `formatShortDate(date: Date | string): string` — DD/MM compact format
- `toInputDate(date: Date | string): string` — YYYY-MM-DD for HTML date inputs
- `getInitials(name: string): string` — first two initials, uppercased

### 2. `app/lib/use-filter-params.ts` — Filter hook

Extracts the identical `handleFilterChange` + `useSubmit` + `useSearchParams` pattern from list pages.

### 3. `app/components/auth/google-icon.tsx` — GoogleIcon

Google SVG previously duplicated in `login.tsx` and `register.tsx`.

### 4. `app/components/layout/back-button.tsx` — BackButton

Back navigation button (`ArrowLeft02Icon` + "Voltar") used on all detail/new pages.

### 5. `app/components/layout/empty-state.tsx` — EmptyState

Centered empty state with icon and message, used on all list pages.

### 6. `app/components/layout/feedback.tsx` — ErrorBanner / SuccessBanner / WarningBanner

Colored alert banners used across ~15 route files.

### 7. `app/components/shared/role-badge.tsx` — RoleBadge + roleLabel

Role label mapping and badge component for org/fraction roles.

### 8. `app/components/shared/delete-dialog.tsx` — DeleteConfirmDialog

AlertDialog delete confirmation used on detail pages with destructive actions.

## Files modified (consumers)

| Shared module          | Files that adopted it                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format.ts`            | `maintenance+/index.tsx`, `maintenance+/$id.tsx`, `tickets+/index.tsx`, `tickets+/$id.tsx`, `suppliers+/$id.tsx`, `fractions+/$id.tsx`                                                                                                                                                                   |
| `use-filter-params.ts` | `tickets+/index.tsx`, `suppliers+/index.tsx`, `maintenance+/index.tsx`                                                                                                                                                                                                                                   |
| `google-icon.tsx`      | `_auth+/login.tsx`, `_auth+/register.tsx`                                                                                                                                                                                                                                                                |
| `back-button.tsx`      | `tickets+/$id.tsx`, `tickets+/new.tsx`, `fractions+/$id.tsx`, `fractions+/new.tsx`, `maintenance+/$id.tsx`, `maintenance+/new.tsx`, `suppliers+/$id.tsx`, `suppliers+/new.tsx`                                                                                                                           |
| `empty-state.tsx`      | `fractions+/index.tsx`, `tickets+/index.tsx`, `suppliers+/index.tsx`, `maintenance+/index.tsx`                                                                                                                                                                                                           |
| `feedback.tsx`         | `login.tsx`, `register.tsx`, `onboarding+/index.tsx`, `invite.$token.tsx`, `fractions+/$id.tsx`, `fractions+/new.tsx`, `tickets+/$id.tsx`, `tickets+/new.tsx`, `suppliers+/$id.tsx`, `suppliers+/new.tsx`, `maintenance+/$id.tsx`, `maintenance+/new.tsx`, `admin+/invites.tsx`, `admin+/categories.tsx` |
| `role-badge.tsx`       | `invite.$token.tsx`, `fractions+/$id.tsx`, `admin+/invites.tsx`                                                                                                                                                                                                                                          |
| `delete-dialog.tsx`    | `fractions+/$id.tsx`, `suppliers+/$id.tsx`, `maintenance+/$id.tsx`                                                                                                                                                                                                                                       |

## Additional changes

- Fixed `vitest.config.ts` — `mergeConfig` can't handle callback-form vite config; switched to standalone config
- Added `app/lib/__tests__/format.test.ts` — 10 unit tests
- Added `.github/workflows/ci.yml` — typecheck + test on PRs and pushes to main
- Updated `CLAUDE.md` — testing section, component org, shared utilities docs
