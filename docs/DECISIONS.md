# Architecture Decisions

> Maintained by Lead Agent. Only explicit decisions that clarify PRD ambiguities.

## D1 — Better Auth org table = our organizations table

Better Auth's org plugin creates an `organization` table. We extend it with custom fields (city,
totalFractions, notes, language, timezone) rather than maintaining a separate table. This avoids
dual-write issues and keeps auth + org data in sync.

## D2 — Two-tier role system

- **Org-level roles** (`org_admin`) live in Better Auth's `member` table
- **Fraction-level roles** (`fraction_owner_admin`, `fraction_member`) live in `user_fractions`
- RBAC guards resolve the effective role by checking both layers

## D3 — IDs are text (UUIDs)

Better Auth uses text IDs for its tables. All app tables follow the same pattern for consistency and
join compatibility.

## D4 — No separate API layer

All data access through React Router loaders/actions (PRD §11). Resource routes only for non-UI
endpoints (file downloads, webhooks).

## D5 — Search text via application code

`search_text` tsvector columns are updated via application code in service functions, not database
triggers. This ensures portability to Neon (which has limitations on custom triggers in some plans).

## D6 — Cost field on maintenance_records

PRD does not mention cost, but maintenance records linked to suppliers logically need it. Added as
optional `numeric(10,2)` field. This is NOT accounting (non-goal) — it's operational record-keeping.

## D7 — Form + action for all forms (no react-hook-form)

All forms use React Router's `Form` or `fetcher.Form` with Zod validation in the route action.
Field-level errors returned as `{ errors: { fieldName: "message" } }` with status 400.
No client-side form libraries. Removed `react-hook-form` and `@hookform/resolvers`.

Reference: https://reactrouter.com/how-to/form-validation
