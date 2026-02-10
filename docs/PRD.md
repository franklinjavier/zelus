# Product Requirements Document (PRD)

## Internal Condominium Management System (v0)

⚠️ This document is the **single source of truth** for development.
It is **self-contained**, **complete**, and **LLM multi-agent safe**.
Agents MUST NOT infer, invent, or optimize beyond what is explicitly defined here.

---

## 1. Vision & Scope

### 1.1 Vision

Build a **simple, safe, and reliable internal management system for residential condominiums**, focused on:

- Reducing repetitive questions and operational noise
- Centralizing institutional knowledge (issues, maintenance, suppliers)
- Preventing incorrect user access and ownership conflicts
- Creating a historical record that survives administrator turnover

The product prioritizes **clarity, safety, and auditability** over automation or clever UX.

Although v0 targets a **single condominium per deployment**, the system MUST be architected as **multi-tenant** to enable evolution into a micro‑SaaS without rework.

---

### 1.2 In-Scope (v0)

The v0 includes:

- Organization (condominium) management
- Fraction (unit) management
- User–fraction association with approval flow
- Role-based access control (RBAC)
- Invite-based onboarding
- Ticketing system (issues)
- Maintenance and intervention history
- Supplier directory
- Internal search / “quick question” system
- In‑app notifications
- Transactional email notifications
- File uploads (photos, documents)

The system MUST be production‑grade.

---

### 1.3 Internationalization

- Initial launch targets Portugal
- **Lingui** for i18n, with **pt-BR** and **en** as the primary supported languages
- All user-facing strings MUST be wrapped in Lingui translation macros

---

## 2. Non‑Goals (Explicitly Out of Scope)

The following MUST NOT be implemented or inferred:

- Accounting, quotas, payments, or invoicing
- Online payments
- Assembly voting or governance tools
- AI‑generated answers or chatbots
- Native mobile applications
- Marketplace or supplier bidding systems
- Cross‑condominium user accounts
- Anonymous or public access

---

## 3. Core Principles & Invariants

These are **hard rules**. Violating them is a bug.

### 3.1 Core Principles

1. **Safety before convenience**
2. **Explicit ownership**
3. **Least privilege by default**
4. **Server‑side enforcement only**
5. **Auditability over automation**
6. **Search retrieves; it does not think**

---

### 3.2 Invariants

#### Organization

- A user belongs to **exactly one organization**
- All data access is scoped by `org_id`
- Cross‑organization access is forbidden

#### Fractions

- A fraction belongs to exactly one organization
- A fraction can have multiple users
- A fraction has **at most one** `fraction_owner_admin`
- Fraction associations have status: `pending | approved | rejected`

#### Roles

- Only `org_admin` can approve or reject fraction associations
- Only `fraction_owner_admin` can invite users to their fraction
- Fraction members cannot self‑associate or invite others

#### Onboarding

- Users cannot freely claim fractions
- First association does NOT automatically confer ownership
- Manual admin override must be possible

#### Enforcement

- All rules enforced server‑side
- Frontend checks are UX only

---

## 4. Personas & Roles

### 4.1 Personas

- **Organization Admin**: manages condominium, validates access, oversees system
- **Fraction Owner Admin**: owner or representative of a fraction
- **Fraction Member**: resident or co‑owner
- **Service Provider**: future external technician (read‑only / limited)

### 4.2 Roles (System)

- `org_admin`
- `fraction_owner_admin`
- `fraction_member`

---

## 5. Permissions & RBAC Matrix

| Action                       | Org Admin | Fraction Owner Admin | Fraction Member |
| ---------------------------- | --------- | -------------------- | --------------- |
| Approve fraction association | Yes       | No                   | No              |
| Invite user to fraction      | Yes       | Yes                  | No              |
| Create ticket                | Yes       | Yes                  | Yes             |
| Update ticket status         | Yes       | Yes                  | No              |
| View all organization data   | Yes       | No                   | No              |
| View own fraction data       | Yes       | Yes                  | Yes             |

---

## 6. Organization & Fraction Model

- Organization == Condominium
- Fractions are pre‑created by Org Admin
- Users request association to a fraction
- Approval required before access is granted
- Admin can reassign or revoke associations

---

## 7. Invite & Onboarding Flows

## 7A. Organization Creation & Initial Onboarding (SaaS)

This section defines the onboarding flow for the **organization creator** (first administrator).
This flow applies only in the SaaS context and happens **before any user invites**.

---

### 7A.1 Organization Creator

- The first user who creates an organization is the **Organization Creator**
- The Organization Creator is automatically assigned the role:
  - `org_admin`
- An organization MUST always have at least one `org_admin`

---

### 7A.2 Flow Overview

1. User signs up (email/password or Google)
2. User has no organization yet
3. User is prompted to create an organization
4. Organization is created
5. User becomes `org_admin`
6. User is redirected to initial setup
7. Organization becomes active

This flow must be **guided and explicit**.

---

### 7A.3 Organization Creation (Wizard)

#### Step 1 — Condominium Details

Required fields:

- Condominium name
- City / location
  Optional fields:
- Total number of fractions
- Notes (internal)

Defaults:

- Language: pt-PT
- Timezone: Europe/Lisbon

---

#### Step 2 — Initial Fraction Setup

Fractions MUST exist before residents can associate.

Options:

- Manual creation (free text labels, e.g. “T3 – 2º Esq.”)
- Simple bulk creation (list input)

No rigid schema (block/door/etc.) is enforced.

---

#### Step 3 — Initial Admin Invites (Optional)

- Org Admin may invite additional admins
- This step can be skipped
- No resident invites at this stage

---

### 7A.4 Invariants

- The Organization Creator is always an `org_admin`
- Organizations cannot exist without an admin
- Organizations are private and not discoverable
- In v0, a user can create **only one organization**
- Organization creation does not auto-create residents

---

### 7A.5 Enforcement

- Organization creation and role assignment must be enforced server-side
- Frontend wizard is UX-only

### 7.1 Organization Invite

1. Org Admin generates invite link
2. User signs up (email/password or Google)
3. User selects fraction
4. Association = `pending`
5. Org Admin approves → user gains access

### 7.2 Fraction Invite

- Fraction Owner Admin invites via email
- Invite auto‑binds to fraction
- No manual fraction selection

---

## 8. Core Functional Requirements

### 8.1 Tickets

- Create, comment, attach files
- Statuses: `open | in_progress | resolved | closed`
- Full immutable history
- Attachments via blob storage

### 8.2 Maintenance History

- Admin‑created records
- Linked supplier, date, description
- Read‑only for residents

### 8.3 Supplier Directory

- Categorized suppliers
- Contact information
- Linked to tickets and maintenance

---

## 9. Search & Q&A System

### 9.1 Purpose

Allow users to ask natural‑language questions and retrieve existing records.

Search performs **retrieval only**.

---

### 9.2 Engine

- Default: Postgres Full‑Text Search (FTS)
- Optional: BM25 via `pg_textsearch` feature flag

---

### 9.3 Search Scopes

- FAQ
- Tickets
- Maintenance records
- Suppliers

All searches are scoped by organization and permissions.

---

### 9.4 Ranking

- Primary: relevance score
- Secondary: recency (where applicable)

---

## 10. Data Model (Logical)

Entities:

- organizations
- users
- fractions
- user_fractions
- tickets
- ticket_comments
- suppliers
- maintenance_records
- notifications
- audit_logs

All entities include `org_id`.

---

## 11. Data Access Pattern

All data loading and mutations use **React Router loaders and actions** within route modules. There is no separate REST API layer.

- `loader` — server-side data fetching, scoped by `org_id` and RBAC
- `action` — server-side mutations (create, update, delete), with form validation
- **Resource routes** — used only for non-UI endpoints (e.g., file downloads, webhook receivers)

Server‑side RBAC enforced on every loader and action.

---

## 12. Frontend Architecture

- React Router
- Route‑level auth guards
- Mobile‑first UI
- Tailwind CSS
- shadcn/ui components

---

## 13. Auth, Security & Multi‑Tenancy

- Better Auth with organization plugin
- Google Auth + email/password
- All queries scoped by `org_id`
- Audit logs for:
  - role changes
  - fraction approvals
  - ticket status changes

---

## 14. Notifications & Emails

- In‑app notifications
- Email via Resend:
  - Invites
  - Approvals
  - Ticket updates
- Email templates as inline HTML strings

---

## 15. Non‑Functional Requirements

- Production‑ready
- Zero cross‑org data leakage
- Idempotent critical actions
- Managed backups (provider‑level)

---

## 16. Tech Stack Constraints

- React Router
- TypeScript
- Tailwind + shadcn/ui
- Zod (schema validation)
- React Hook Form (form state management)
- Better Auth
- Postgres (Docker local, Neon prod)
- Drizzle ORM
- Vercel
- Vercel Blob
- Resend

---

## 17. Out of Scope / Future Ideas

- Payments and accounting
- Native apps
- Supplier marketplace

---

## 18. Open Questions

None. All requirements are closed.

---

END OF PRD
