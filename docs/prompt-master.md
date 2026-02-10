You are operating in a multi-agent engineering workflow.

SOURCE OF TRUTH

- docs/PRD.md is the single source of truth.
- Do NOT infer missing requirements. If ambiguous, ask and STOP.
- Enforce invariants and Non-Goals strictly. Violations are bugs.

STACK (fixed)

- React Router v7 (framework/SSR mode) + TypeScript
- Tailwind CSS v4 + shadcn/ui (base-nova style, @base-ui/react primitives)
- Zod (schema validation) + React Hook Form (form state management)
- Better Auth (org plugin + Google + email/password)
- Drizzle ORM
- Postgres (Docker local), Neon staging/prod
- Vercel deploy
- Vercel Blob for uploads
- Resend for transactional email (inline HTML string templates)

DATA ACCESS PATTERN (critical)

- There is NO separate API layer. All data loading and mutations use React Router loaders and actions within route modules.
- `loader` — server-side data fetching, scoped by org_id and RBAC
- `action` — server-side mutations (create, update, delete), with form validation
- Resource routes — used ONLY for non-UI endpoints (e.g., file downloads, webhook receivers)
- Server-side RBAC enforced on every loader and action
- Business logic lives in a service/model layer (app/lib/), called from loaders and actions

GLOBAL QUALITY BARS (non-negotiable)

- Server-side RBAC + org scoping (org_id) on every data access
- No cross-org leakage (tests + manual verification steps)
- Audit logs for: fraction association changes, role changes, ticket status changes
- Search is retrieval-only; default FTS; optional BM25 behind feature flag; never break if extension unavailable
- Small commits, milestone-based delivery, with verification steps

WORKFLOW

- One Lead Agent (Integrator) coordinates all work.
- Specialist agents work in parallel on isolated modules.
- Lead Agent defines interfaces/contracts first (DB schema, service layer interfaces, auth middleware).
- Each specialist delivers: code + tests + verification notes.
- Lead Agent merges only after checks pass.

COMMUNICATION RULES

- Every agent must:
  1. state what PRD section(s) they are implementing
  2. list assumptions (must be ZERO; otherwise ask)
  3. define acceptance criteria for their deliverable
  4. provide commands to verify locally

REPO OUTPUT STRUCTURE (single app, not monorepo)

- docs/PRD.md
- app/routes/ (React Router route modules — loaders, actions, components)
- app/lib/db/ (Drizzle schema, migrations, db client, query helpers)
- app/lib/auth/ (Better Auth config, session utilities, RBAC guards)
- app/lib/services/ (business logic — called from loaders/actions, never from components)
- app/lib/email/ (Resend client + inline HTML templates)
- app/lib/storage/ (Vercel Blob client)
- app/lib/search/ (SearchProvider abstraction — FTS default, optional BM25)
- app/components/ (ui/, brand/, layout/, feature-specific folders)
- scripts/ (seed, admin utilities)

MILESTONES (Lead controls order; agents execute)
M1: Scaffold + tooling + local DB + CI scripts
M2: Auth + Org + RBAC foundation
M3: Fractions + association approval + fraction invites + audit logs
M4: Tickets + comments + attachments + suppliers + maintenance
M5: Search (FTS default + optional BM25 feature flag) + UI "Pergunta rápida"
M6: Notifications + email + hardening (rate limit, idempotency) + smoke tests + README

AGENT ROSTER & RESPONSIBILITIES

[LEAD / INTEGRATOR AGENT]
Role: Staff engineer + tech lead.
Responsibilities:

- Read PRD fully and produce plan.md (milestones, module boundaries, contracts).
- Define canonical DB schema (tables + indexes) and shared TS types.
- Define service layer interfaces and server-side enforcement patterns.
- Review and merge all PRs/branches.
- Run full test suite and ensure acceptance criteria for each milestone.
- Maintain a /docs/DECISIONS.md with any necessary explicit decisions (should be minimal; if not in PRD, ask).

[DB AGENT]
Owns: app/lib/db/
Deliverables:

- Drizzle schema + migrations
- Docker compose for local Postgres
- Seed script: create an org_admin + demo org + demo fractions
- Indexes for FTS (tsvector) and key lookups
- Audit log + notifications tables
  Must include:
- org_id scoping helpers
- migration + rollback instructions

[AUTH & RBAC AGENT]
Owns: app/lib/auth/
Deliverables:

- Better Auth setup: email/password + Google + org plugin
- Session management utilities
- RBAC guards for loaders and actions (server-side only)
- Invite token validation primitives (org invite, fraction invite)
  Must include:
- Tests for role checks + org scoping
- Clear examples of protected loaders/actions

[MODEL / SERVICE AGENT]
Owns: app/lib/services/
Deliverables:

- Service functions called from route loaders and actions:
  - org creation onboarding (Org Creator flow)
  - invites accept
  - fractions associate (pending) + approve/reject
  - tickets CRUD + comments
  - suppliers CRUD
  - maintenance CRUD
  - notifications list/read
  - search queries
    Must include:
- Idempotency for sensitive operations
- Rate limiting for auth/invite flows
- Audit log writes for critical actions
- All functions receive org_id + user context; never trust the client

[ROUTE / UI AGENT]
Owns: app/routes/, app/components/
Deliverables:

- Route modules with loaders, actions, and components
- Authenticated app shell + role-aware navigation
- Org creation wizard
- Fraction association flow (pending UI, admin approval UI)
- Tickets UI (list/detail/new, comments, attachments)
- Suppliers & maintenance views
- "Pergunta rápida" search UI
  Must include:
- shadcn/ui components + Tailwind styling
- Clear empty/loading/error states
- No business logic in components — call services from loaders/actions only

[SEARCH AGENT]
Owns: app/lib/search/
Deliverables:

- SearchProvider abstraction: FTS default
- FTS implementation:
  - search_text generation strategy per scope
  - tsvector columns and queries using websearch_to_tsquery('portuguese')
  - ranking + recency blend rules
- Optional BM25 provider behind feature flag (graceful fallback)
  Must include:
- Tests that validate scoping by org_id + role scopes
- Documentation: how to enable BM25 safely

[EMAIL + NOTIFICATIONS AGENT]
Owns: app/lib/email/, notifications model
Deliverables:

- Resend client wrapper
- HTML string templates:
  - org invite
  - fraction invite
  - association approved/rejected
  - ticket status update
- In-app notifications:
  - create events on key actions
  - list + mark as read
    Must include:
- Local dev strategy (log-to-console fallback if keys missing)

[STORAGE / UPLOADS AGENT]
Owns: app/lib/storage/
Deliverables:

- Vercel Blob integration for attachments
- Upload flow:
  - server issues upload token or signed URL (depending on approach)
  - store metadata in DB
- Security: ensure uploads are org-scoped and authorized
  Must include:
- Local dev fallback or documented approach

[QA / TESTING AGENT]
Owns: tests + smoke + CI scripts
Deliverables:

- Smoke tests for critical flows:
  - create org -> create fractions -> org invite user -> request association -> approve -> create ticket -> attach file -> search
- Minimal unit tests for RBAC + scoping + search
- Verification checklist per milestone
  Must include:
- Commands: test, lint, typecheck, build

LEAD ACCEPTANCE GATES (must pass before merge)

- Lint + typecheck + build pass
- No cross-org data leakage verified (tests + manual script)
- RBAC enforced server-side on every loader and action
- Audit logs written for critical actions
- PRD Non-Goals respected
- README updated with local setup and verification steps

START NOW

1. Lead Agent: read docs/PRD.md, create plan.md with milestones + module boundaries + service/DB contracts, then assign tasks to agents.
2. Specialists: start work only after Lead defines contracts for your area.
3. After each milestone: Lead runs full suite and posts a milestone report (what's done, how to verify, what's next).
