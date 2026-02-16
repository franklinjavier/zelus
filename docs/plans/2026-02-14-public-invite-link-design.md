# Public Invite Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to share a single reusable link (like WhatsApp groups) that anyone can use to join the condominium.

**Architecture:** Add `inviteCode` and `inviteEnabled` columns to the existing `organization` table. New public route `/join/$code` handles the join flow. Admin controls in the existing `/admin/organization` page.

**Tech Stack:** React Router v7, Drizzle ORM, Better Auth org plugin, PostgreSQL

---

### Task 1: Database Migration — Add invite columns to organization table

**Files:**

- Modify: `app/lib/db/schema/auth.ts:69-82`
- Modify: `app/lib/auth/auth.server.ts:88-116`
- Create: migration via `bun run db:generate`

**Step 1: Add columns to Drizzle schema**

In `app/lib/db/schema/auth.ts`, add to the `organization` table definition:

```typescript
export const organization = pgTable('organization', {
  // ... existing fields ...
  language: text('language').notNull().default('pt-PT'),
  timezone: text('timezone').notNull().default('Europe/Lisbon'),
  // Public invite link
  inviteCode: text('invite_code'),
  inviteEnabled: boolean('invite_enabled').notNull().default(false),
})
```

Import `boolean` from `drizzle-orm/pg-core`.

**Step 2: Add fields to Better Auth org plugin config**

In `app/lib/auth/auth.server.ts`, add to `additionalFields`:

```typescript
inviteCode: {
  type: 'string',
  required: false,
  input: false, // not user-settable via Better Auth API
},
inviteEnabled: {
  type: 'boolean',
  required: false,
  input: false,
  defaultValue: false,
},
```

**Step 3: Generate and apply migration**

Run: `bun run db:generate add-invite-link`
Run: `bun run db:migrate`

**Step 4: Commit**

```bash
git add app/lib/db/schema/auth.ts app/lib/auth/auth.server.ts app/lib/db/migrations/
git commit -m "feat: add invite_code and invite_enabled columns to organization"
```

---

### Task 2: Invite Link Service — Generate, enable, regenerate codes

**Files:**

- Create: `app/lib/services/invite-link.ts`

**Step 1: Create the service**

```typescript
import { eq } from 'drizzle-orm'
import { db } from '~/lib/db'
import { organization } from '~/lib/db/schema'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  for (const byte of bytes) {
    code += chars[byte % chars.length]
  }
  return code
}

export async function getInviteLink(orgId: string) {
  const [org] = await db
    .select({ inviteCode: organization.inviteCode, inviteEnabled: organization.inviteEnabled })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  return org ?? null
}

export async function enableInviteLink(orgId: string) {
  const [org] = await db
    .select({ inviteCode: organization.inviteCode })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)

  const code = org?.inviteCode || generateCode()

  await db
    .update(organization)
    .set({ inviteCode: code, inviteEnabled: true })
    .where(eq(organization.id, orgId))

  return code
}

export async function disableInviteLink(orgId: string) {
  await db.update(organization).set({ inviteEnabled: false }).where(eq(organization.id, orgId))
}

export async function regenerateInviteCode(orgId: string) {
  const code = generateCode()
  await db
    .update(organization)
    .set({ inviteCode: code, inviteEnabled: true })
    .where(eq(organization.id, orgId))
  return code
}

export async function getOrgByInviteCode(code: string) {
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      inviteEnabled: organization.inviteEnabled,
    })
    .from(organization)
    .where(eq(organization.inviteCode, code))
    .limit(1)
  return org ?? null
}
```

**Step 2: Commit**

```bash
git add app/lib/services/invite-link.ts
git commit -m "feat: add invite link service (generate, enable, disable, regenerate)"
```

---

### Task 3: Admin UI — Invite link card in organization settings

**Files:**

- Modify: `app/routes/_protected+/admin+/organization.tsx`

**Step 1: Update the loader to include invite link state**

Add to the select query: `inviteCode: organization.inviteCode` and `inviteEnabled: organization.inviteEnabled`.

**Step 2: Add actions for invite link management**

Add to the existing action handler, checking for `intent` field:

- `intent === 'toggle-invite'` → call `enableInviteLink()` or `disableInviteLink()` based on current state
- `intent === 'regenerate-invite'` → call `regenerateInviteCode()`

Keep existing form handling for `intent` being absent (default org update form).

**Step 3: Add the Invite Link card to the component**

After the existing cards, add a new card with:

- Toggle switch (or button) to enable/disable
- When enabled: show the link URL with a copy button
- Regenerate button with confirmation text
- Muted description explaining what the link does

Use `useFetcher` for the toggle/regenerate actions so the page doesn't navigate.

**Step 4: Commit**

```bash
git add app/routes/_protected+/admin+/organization.tsx
git commit -m "feat: add invite link management to org settings"
```

---

### Task 4: Public Join Route — `/join/$code`

**Files:**

- Create: `app/routes/join.$code.tsx`

**Step 1: Create the route**

Model after `app/routes/invite.$token.tsx` but simpler:

**Loader:**

1. Look up org by code via `getOrgByInviteCode(params.code)`
2. If not found or not enabled → return `{ error: 'invalid' }`
3. Check session — if not authenticated → return `{ org, authenticated: false }`
4. Check if already a member (query `member` table) → return `{ org, alreadyMember: true }`
5. Return `{ org, authenticated: true, alreadyMember: false }`

**Action:**

1. Require session (redirect to login if missing, with return URL)
2. Look up org by code, validate enabled
3. Check if already a member — if yes, just redirect to dashboard
4. Insert into `member` table with `role: 'member'`
5. Call `auth.api.setActiveOrganization()` to set active org cookie
6. Forward cookies + redirect to `/dashboard` with toast

**Component:**

- Same centered card layout as `invite.$token.tsx`
- Show org name, "Join {org.name}" title
- If not authenticated: login/register buttons with redirect
- If authenticated + not member: "Join" button
- If already member: redirect or "You're already a member" message
- If invalid/disabled: error state

Use `AzulejoPattern`, `ZelusLogoTile`, same brand components as the invite page.

**Step 2: Commit**

```bash
git add app/routes/join.$code.tsx
git commit -m "feat: add public join route for invite links"
```

---

### Task 5: Typecheck and manual test

**Step 1: Run typecheck**

Run: `bun run typecheck`

**Step 2: Manual test flow**

1. Go to `/admin/organization`, enable the invite link
2. Copy the link
3. Open in incognito → should show login/register prompt
4. Register a new account → should auto-redirect back to join page
5. Click join → should land on dashboard with toast
6. Verify user appears in org members
7. Disable the link → verify the URL shows "not active"
8. Regenerate → verify old URL stops working

**Step 3: Commit any fixes**

```bash
git commit -m "fix: address issues found in manual testing"
```
