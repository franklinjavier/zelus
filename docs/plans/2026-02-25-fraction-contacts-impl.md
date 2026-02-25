# Fraction Contacts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow org admins to pre-register resident contact records on a fraction (name, NIF, phone,
email, notes) and later link those records to real user accounts.

**Architecture:** New `fraction_contacts` table in the existing schema; new service file; three new
drawer routes under `fractions/$id/contacts+/`; contacts section added to the fraction detail
layout. Linking a contact creates an approved `user_fractions` association automatically.

**Tech Stack:** Drizzle ORM (PostgreSQL), React Router v7 framework mode, Zod via `validateForm`,
shadcn/ui primitives, HugeIcons.

**Design doc:** `docs/plans/2026-02-25-fraction-contacts-design.md`

---

## Task 1: Add `fractionContacts` table to schema

**Files:**

- Modify: `app/lib/db/schema/fractions.ts`

**Step 1: Add the table definition**

Append to `app/lib/db/schema/fractions.ts` after the `userFractions` table:

```typescript
export const fractionContacts = pgTable(
  'fraction_contacts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    fractionId: text('fraction_id')
      .notNull()
      .references(() => fractions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nif: text('nif'),
    mobile: text('mobile'),
    phone: text('phone'),
    email: text('email'),
    notes: text('notes'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('fraction_contacts_org_fraction_idx').on(t.orgId, t.fractionId),
    index('fraction_contacts_org_user_idx').on(t.orgId, t.userId),
    // PostgreSQL allows multiple NULLs in a unique index, so this safely
    // prevents linking the same user to two contacts in the same fraction.
    uniqueIndex('fraction_contacts_fraction_user_idx').on(t.fractionId, t.userId),
  ],
)
```

Note: `app/lib/db/schema/index.ts` already re-exports everything from `fractions.ts` — no change needed there.

**Step 2: Verify the file compiles**

```bash
bun run typecheck
```

Expected: exits 0 (no errors).

**Step 3: Commit**

```bash
git add app/lib/db/schema/fractions.ts
git commit -m "feat: add fractionContacts schema table"
```

---

## Task 2: Generate and apply migration

**Step 1: Generate migration**

```bash
bun run db:generate add-fraction-contacts
```

Expected: creates `app/lib/db/migrations/0013_add-fraction-contacts.sql` (number may differ).

**Step 2: Review the generated SQL**

Open the new `.sql` file and confirm it contains:

- `CREATE TABLE "fraction_contacts"` with all expected columns
- `CREATE INDEX` statements for the three indexes
- `CREATE UNIQUE INDEX` for the fraction+user index

**Step 3: Apply migration**

```bash
bun run db:migrate
```

Expected: prints SQL preview, prompts for confirmation, applies successfully.

**Step 4: Commit**

```bash
git add app/lib/db/migrations/
git commit -m "feat: migration — add fraction_contacts table"
```

---

## Task 3: Create service file

**Files:**

- Create: `app/lib/services/fraction-contacts.ts`

**Step 1: Write the service**

```typescript
import { and, eq, isNull, notInArray } from 'drizzle-orm'

import { db } from '~/lib/db'
import { fractionContacts, userFractions, member, user } from '~/lib/db/schema'
import { logAuditEvent } from './audit'

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listFractionContacts(orgId: string, fractionId: string) {
  return db
    .select({
      id: fractionContacts.id,
      name: fractionContacts.name,
      nif: fractionContacts.nif,
      mobile: fractionContacts.mobile,
      phone: fractionContacts.phone,
      email: fractionContacts.email,
      notes: fractionContacts.notes,
      userId: fractionContacts.userId,
      linkedUserName: user.name,
      linkedUserEmail: user.email,
      linkedUserImage: user.image,
    })
    .from(fractionContacts)
    .leftJoin(user, eq(fractionContacts.userId, user.id))
    .where(and(eq(fractionContacts.orgId, orgId), eq(fractionContacts.fractionId, fractionId)))
    .orderBy(fractionContacts.name)
}

/** Org members that are NOT already linked to a contact in this fraction. */
export async function listLinkableOrgMembers(orgId: string, fractionId: string) {
  const linkedUserIds = await db
    .select({ userId: fractionContacts.userId })
    .from(fractionContacts)
    .where(
      and(
        eq(fractionContacts.orgId, orgId),
        eq(fractionContacts.fractionId, fractionId),
        // only rows that are already linked
      ),
    )
    .then((rows) => rows.map((r) => r.userId).filter(Boolean) as string[])

  const query = db
    .select({ userId: member.userId, userName: user.name, userEmail: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId))

  const allMembers = await query

  return linkedUserIds.length > 0
    ? allMembers.filter((m) => !linkedUserIds.includes(m.userId))
    : allMembers
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type ContactData = {
  name: string
  nif?: string | null
  mobile?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
}

export async function createContact(
  orgId: string,
  fractionId: string,
  data: ContactData,
  adminUserId: string,
) {
  const [contact] = await db
    .insert(fractionContacts)
    .values({ orgId, fractionId, createdBy: adminUserId, ...data })
    .returning()

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.created',
    entityType: 'fraction_contact',
    entityId: contact.id,
    metadata: { fractionId, name: data.name },
  })

  return contact
}

export async function updateContact(
  orgId: string,
  contactId: string,
  data: ContactData,
  adminUserId: string,
) {
  const [contact] = await db
    .update(fractionContacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .returning()

  if (!contact) throw new Error('Contacto não encontrado.')

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.updated',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: { name: data.name },
  })

  return contact
}

export async function deleteContact(orgId: string, contactId: string, adminUserId: string) {
  const [contact] = await db
    .delete(fractionContacts)
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .returning()

  if (!contact) throw new Error('Contacto não encontrado.')

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.deleted',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: { name: contact.name },
  })
}

export async function linkContactToUser(
  orgId: string,
  contactId: string,
  userId: string,
  adminUserId: string,
) {
  const [contact] = await db
    .select()
    .from(fractionContacts)
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .limit(1)

  if (!contact) throw new Error('Contacto não encontrado.')
  if (contact.userId) throw new Error('Contacto já associado a uma conta.')

  // Verify the user is an org member
  const [membership] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .limit(1)

  if (!membership) throw new Error('Utilizador não é membro do condomínio.')

  // Link contact → user
  await db
    .update(fractionContacts)
    .set({ userId, updatedAt: new Date() })
    .where(eq(fractionContacts.id, contactId))

  // Create or approve the user_fractions association
  const [existingAssoc] = await db
    .select()
    .from(userFractions)
    .where(
      and(
        eq(userFractions.orgId, orgId),
        eq(userFractions.userId, userId),
        eq(userFractions.fractionId, contact.fractionId),
      ),
    )
    .limit(1)

  if (existingAssoc) {
    if (existingAssoc.status !== 'approved') {
      await db
        .update(userFractions)
        .set({ status: 'approved', approvedBy: adminUserId, updatedAt: new Date() })
        .where(eq(userFractions.id, existingAssoc.id))
    }
  } else {
    await db.insert(userFractions).values({
      orgId,
      userId,
      fractionId: contact.fractionId,
      role: 'fraction_member',
      status: 'approved',
      approvedBy: adminUserId,
    })
  }

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.linked',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: { linkedUserId: userId },
  })
}

export async function unlinkContact(orgId: string, contactId: string, adminUserId: string) {
  const [contact] = await db
    .update(fractionContacts)
    .set({ userId: null, updatedAt: new Date() })
    .where(and(eq(fractionContacts.id, contactId), eq(fractionContacts.orgId, orgId)))
    .returning()

  if (!contact) throw new Error('Contacto não encontrado.')

  await logAuditEvent({
    orgId,
    userId: adminUserId,
    action: 'contact.unlinked',
    entityType: 'fraction_contact',
    entityId: contactId,
    metadata: {},
  })
}
```

**Step 2: Verify types compile**

```bash
bun run typecheck
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add app/lib/services/fraction-contacts.ts
git commit -m "feat: fraction-contacts service (CRUD + link/unlink)"
```

---

## Task 4: Route — create contact (`contacts/new`)

**Files:**

- Create: `app/routes/_protected+/fractions+/$id+/contacts+/new.tsx`

**Step 1: Write the route**

```typescript
import { href, redirect } from 'react-router'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createContact } from '~/lib/services/fraction-contacts'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldLabel } from '~/components/ui/field'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { Form } from 'react-router'

export async function loader({ context }: Route.LoaderArgs) {
  const { effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })
  return {}
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Nome obrigatório.' }

  try {
    await createContact(
      orgId,
      params.id,
      {
        name,
        nif: (formData.get('nif') as string) || null,
        mobile: (formData.get('mobile') as string) || null,
        phone: (formData.get('phone') as string) || null,
        email: (formData.get('email') as string) || null,
        notes: (formData.get('notes') as string) || null,
      },
      user.id,
    )
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Contacto adicionado.'),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar contacto.' }
  }
}

export default function NewContactPage({ actionData }: Route.ComponentProps) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Adicionar contacto</DrawerTitle>
        <DrawerDescription>Registe os dados de um residente.</DrawerDescription>
      </DrawerHeader>
      <div className="px-6 pb-6">
        {actionData && 'error' in actionData && (
          <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
        )}
        <Form method="post" className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="name">Nome *</FieldLabel>
            <Input id="name" name="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field>
            <FieldLabel htmlFor="mobile">Telemóvel</FieldLabel>
            <Input id="mobile" name="mobile" type="tel" />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Telefone</FieldLabel>
            <Input id="phone" name="phone" type="tel" />
          </Field>
          <Field>
            <FieldLabel htmlFor="nif">NIF</FieldLabel>
            <Input id="nif" name="nif" />
          </Field>
          <Field>
            <FieldLabel htmlFor="notes">Notas</FieldLabel>
            <Textarea id="notes" name="notes" rows={3} />
          </Field>
          <Button type="submit" className="mt-1">
            Adicionar contacto
          </Button>
        </Form>
      </div>
    </>
  )
}
```

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add app/routes/_protected+/fractions+/$id+/contacts+/new.tsx
git commit -m "feat: route — create fraction contact"
```

---

## Task 5: Route — edit/delete contact (`contacts/$contactId/edit`)

**Files:**

- Create: `app/routes/_protected+/fractions+/$id+/contacts+/$contactId+/edit.tsx`

**Step 1: Write the route**

```typescript
import { href, redirect, Form, useFetcher } from 'react-router'

import type { Route } from './+types/edit'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  listFractionContacts,
  updateContact,
  deleteContact,
} from '~/lib/services/fraction-contacts'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldLabel } from '~/components/ui/field'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { setToast } from '~/lib/toast.server'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const contacts = await listFractionContacts(orgId, params.id)
  const contact = contacts.find((c) => c.id === params.contactId)
  if (!contact) throw new Response('Not Found', { status: 404 })

  return { contact }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'update') {
    const name = (formData.get('name') as string)?.trim()
    if (!name) return { error: 'Nome obrigatório.' }

    try {
      await updateContact(
        orgId,
        params.contactId,
        {
          name,
          nif: (formData.get('nif') as string) || null,
          mobile: (formData.get('mobile') as string) || null,
          phone: (formData.get('phone') as string) || null,
          email: (formData.get('email') as string) || null,
          notes: (formData.get('notes') as string) || null,
        },
        user.id,
      )
      return redirect(href('/fractions/:id', { id: params.id }), {
        headers: await setToast('Contacto actualizado.'),
      })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao actualizar contacto.' }
    }
  }

  if (intent === 'delete') {
    try {
      await deleteContact(orgId, params.contactId, user.id)
      return redirect(href('/fractions/:id', { id: params.id }), {
        headers: await setToast('Contacto apagado.'),
      })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar contacto.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function EditContactPage({ loaderData, actionData }: Route.ComponentProps) {
  const { contact } = loaderData
  const fetcher = useFetcher()

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Editar contacto</DrawerTitle>
        <DrawerDescription>Altere os dados do contacto.</DrawerDescription>
      </DrawerHeader>
      <div className="px-6 pb-6">
        {actionData && 'error' in actionData && (
          <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
        )}
        <Form method="post" className="grid gap-3">
          <input type="hidden" name="intent" value="update" />
          <Field>
            <FieldLabel htmlFor="name">Nome *</FieldLabel>
            <Input id="name" name="name" defaultValue={contact.name} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" name="email" type="email" defaultValue={contact.email ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="mobile">Telemóvel</FieldLabel>
            <Input id="mobile" name="mobile" type="tel" defaultValue={contact.mobile ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Telefone</FieldLabel>
            <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nif">NIF</FieldLabel>
            <Input id="nif" name="nif" defaultValue={contact.nif ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="notes">Notas</FieldLabel>
            <Textarea id="notes" name="notes" rows={3} defaultValue={contact.notes ?? ''} />
          </Field>
          <div className="flex items-center justify-between pt-2">
            <DeleteConfirmDialog
              title="Apagar contacto?"
              description="Esta ação não pode ser revertida."
            >
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <AlertDialogAction type="submit">Apagar</AlertDialogAction>
              </fetcher.Form>
            </DeleteConfirmDialog>
            <Button type="submit">Guardar</Button>
          </div>
        </Form>
      </div>
    </>
  )
}
```

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add "app/routes/_protected+/fractions+/$id+/contacts+/$contactId+/edit.tsx"
git commit -m "feat: route — edit/delete fraction contact"
```

---

## Task 6: Route — link contact to user account (`contacts/$contactId/link`)

**Files:**

- Create: `app/routes/_protected+/fractions+/$id+/contacts+/$contactId+/link.tsx`

**Step 1: Write the route**

```typescript
import { href, redirect, Form } from 'react-router'

import type { Route } from './+types/link'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  listFractionContacts,
  listLinkableOrgMembers,
  linkContactToUser,
} from '~/lib/services/fraction-contacts'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Field, FieldLabel } from '~/components/ui/field'
import { DrawerHeader, DrawerTitle, DrawerDescription } from '~/components/ui/drawer'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const contacts = await listFractionContacts(orgId, params.id)
  const contact = contacts.find((c) => c.id === params.contactId)
  if (!contact) throw new Response('Not Found', { status: 404 })
  if (contact.userId) throw new Response('Already linked', { status: 400 })

  const linkableMembers = await listLinkableOrgMembers(orgId, params.id)

  return { contact, linkableMembers }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })

  const formData = await request.formData()
  const userId = formData.get('userId') as string
  if (!userId) return { error: 'Seleccione um utilizador.' }

  try {
    await linkContactToUser(orgId, params.contactId, userId, user.id)
    return redirect(href('/fractions/:id', { id: params.id }), {
      headers: await setToast('Conta associada.'),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao associar conta.' }
  }
}

export default function LinkContactPage({ loaderData, actionData }: Route.ComponentProps) {
  const { contact, linkableMembers } = loaderData

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Associar conta — {contact.name}</DrawerTitle>
        <DrawerDescription>
          Seleccione o utilizador registado que corresponde a este contacto.
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-6 pb-6">
        {actionData && 'error' in actionData && (
          <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
        )}
        {linkableMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Não existem membros disponíveis para associar.
          </p>
        ) : (
          <Form method="post" className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="userId">Utilizador</FieldLabel>
              <Select
                name="userId"
                items={linkableMembers.map((m) => ({ value: m.userId, label: m.userName }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar utilizador…" />
                </SelectTrigger>
                <SelectContent>
                  {linkableMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <span>{m.userName}</span>
                      <span className="text-muted-foreground ml-1.5 text-sm">
                        {m.userEmail}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" className="mt-1">
              Associar conta
            </Button>
          </Form>
        )}
      </div>
    </>
  )
}
```

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add "app/routes/_protected+/fractions+/$id+/contacts+/$contactId+/link.tsx"
git commit -m "feat: route — link fraction contact to user account"
```

---

## Task 7: Update fraction detail layout

**Files:**

- Modify: `app/routes/_protected+/fractions+/$id+/_layout.tsx`

This is the most involved step. Changes:

1. Import new service + new icons
2. Add `contacts` to loader (admin-only)
3. Add `delete-contact` and `unlink-contact` action intents
4. Add `ContactsCard` component
5. Add contacts section to the JSX
6. Expand `isDrawerOpen` to cover new routes

**Step 1: Add imports**

At the top of the file, add to imports:

- `Delete02Icon` is already imported
- Add `UserCheck01Icon` from `@hugeicons/core-free-icons` (for "Associar conta")
- Add `listFractionContacts` from `~/lib/services/fraction-contacts`
- Add `deleteContact, unlinkContact` from `~/lib/services/fraction-contacts`
- Add `Badge` is already imported

**Step 2: Update loader**

Add to the loader return, after `orgMembers`:

```typescript
const contacts = isAdmin ? await listFractionContacts(orgId, params.id) : []
return { fraction, members, isAdmin, isMember, canInvite, orgMembers, contacts }
```

**Step 3: Add action intents**

After the `bulk-assign-users` intent block (before the final `return { error: 'Ação desconhecida.' }`):

```typescript
if (intent === 'delete-contact') {
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })
  const contactId = formData.get('contactId') as string
  try {
    await deleteContact(orgId, contactId, user.id)
    return data({ success: true }, { headers: await setToast('Contacto apagado.') })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao apagar contacto.'
    return data({ error: msg }, { headers: await setToast(msg, 'error') })
  }
}

if (intent === 'unlink-contact') {
  if (effectiveRole !== 'org_admin') throw new Response('Forbidden', { status: 403 })
  const contactId = formData.get('contactId') as string
  try {
    await unlinkContact(orgId, contactId, user.id)
    return data({ success: true }, { headers: await setToast('Conta desassociada.') })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao desassociar conta.'
    return data({ error: msg }, { headers: await setToast(msg, 'error') })
  }
}
```

**Step 4: Expand `isDrawerOpen` check**

```typescript
const isDrawerOpen = matches.some((m) => {
  const p = m.pathname
  return p.endsWith('/edit') || p.endsWith('/invite') || p.endsWith('/new') || p.endsWith('/link')
})
```

**Step 5: Add contacts to the component props and JSX**

In the component, destructure `contacts` from `loaderData`. After the `BulkAssignMembersDrawer`, add:

```tsx
{
  ;(isAdmin && contacts.length > 0) || isAdmin ? (
    <div className="mt-6">
      <ContactsCard contacts={contacts} fractionId={fraction.id} />
    </div>
  ) : null
}
```

Simpler: always render for admins:

```tsx
{
  isAdmin && (
    <div className="mt-6">
      <ContactsCard contacts={contacts} fractionId={fraction.id} />
    </div>
  )
}
```

**Step 6: Add `ContactsCard` component**

Add after the `BulkAssignMembersDrawer` function:

```typescript
type ContactRow = {
  id: string
  name: string
  nif: string | null
  mobile: string | null
  phone: string | null
  email: string | null
  notes: string | null
  userId: string | null
  linkedUserName: string | null
  linkedUserEmail: string | null
  linkedUserImage: string | null
}

function ContactsCard({
  contacts,
  fractionId,
}: {
  contacts: ContactRow[]
  fractionId: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Contactos
          <span className="text-muted-foreground ml-1.5 font-normal">{contacts.length}</span>
        </h2>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={href('/fractions/:id/contacts/new', { id: fractionId })} />}
        >
          <HugeiconsIcon icon={UserAdd01Icon} data-icon="inline-start" size={16} strokeWidth={2} />
          Adicionar contacto
        </Button>
      </div>
      {contacts.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10">
          <div className="bg-muted flex size-12 items-center justify-center rounded-2xl">
            <HugeiconsIcon
              icon={UserMultiple02Icon}
              size={20}
              strokeWidth={1.5}
              className="text-muted-foreground"
            />
          </div>
          <p className="text-muted-foreground text-sm">Nenhum contacto registado</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} fractionId={fractionId} />
          ))}
        </div>
      )}
    </div>
  )
}

function ContactRow({ contact: c, fractionId }: { contact: ContactRow; fractionId: string }) {
  const fetcher = useFetcher()
  const detail = [c.email, c.mobile || c.phone, c.nif ? `NIF ${c.nif}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="ring-foreground/5 flex items-start gap-3 rounded-2xl p-3 ring-1 @sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{c.name}</p>
          {c.userId && <Badge variant="secondary">Conta associada</Badge>}
        </div>
        {detail && <p className="text-muted-foreground truncate text-sm">{detail}</p>}
        {c.notes && <p className="text-muted-foreground truncate text-sm italic">{c.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <Link
              to={href('/fractions/:id/contacts/:contactId/edit', {
                id: fractionId,
                contactId: c.id,
              })}
            />
          }
        >
          Editar
        </Button>
        {!c.userId ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                to={href('/fractions/:id/contacts/:contactId/link', {
                  id: fractionId,
                  contactId: c.id,
                })}
              />
            }
          >
            Associar conta
          </Button>
        ) : (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="unlink-contact" />
            <input type="hidden" name="contactId" value={c.id} />
            <Button type="submit" variant="outline" size="sm">
              Desassociar
            </Button>
          </fetcher.Form>
        )}
      </div>
    </div>
  )
}
```

**Step 7: Add `href` for new routes**

The `href()` calls above reference routes that don't exist in the type system yet. After running `bun run typecheck` once, React Router will generate the types. Run:

```bash
bun run typecheck
```

If there are missing `href` route errors, it means the route files from Tasks 4–6 were not created correctly. Verify the file paths match exactly.

Expected: exits 0.

**Step 8: Commit**

```bash
git add "app/routes/_protected+/fractions+/$id+/_layout.tsx"
git commit -m "feat: contacts section on fraction detail page"
```

---

## Task 8: Smoke test in browser

**Step 1: Start dev server**

```bash
bun run dev
```

**Step 2: Test Phase 1 — create contact**

1. Go to any fraction detail page as org admin
2. Scroll to new **Contactos** section — should show empty state with "Adicionar contacto" button
3. Click "Adicionar contacto" → drawer opens with the form
4. Fill in Name (required), email, NIF → submit
5. Drawer closes, toast "Contacto adicionado." appears
6. Contact appears in the list

**Step 3: Test edit/delete**

1. Click "Editar" on a contact → drawer opens pre-filled
2. Change a field → submit → toast "Contacto actualizado."
3. Open edit drawer → click "Apagar" → confirm → toast "Contacto apagado."

**Step 4: Test Phase 3 — link to user**

1. Ensure at least one org member exists who is NOT already linked
2. Click "Associar conta" on an unlinked contact
3. Drawer shows user list → select a user → submit
4. Toast "Conta associada." — contact now shows "Conta associada" badge
5. Check fraction **Membros** section — linked user now appears as a member

**Step 5: Test unlink**

1. Click "Desassociar" on a linked contact
2. Badge disappears — "Associar conta" button returns
3. User remains in Membros section (unlink does NOT remove the association)

---

## Task 9: Final typecheck and tests

**Step 1: Full typecheck**

```bash
bun run typecheck
```

Expected: exits 0.

**Step 2: Run tests**

```bash
bun run test
```

Expected: all existing tests pass (no regressions).

**Step 3: Final commit if anything was adjusted**

```bash
git add -p
git commit -m "fix: typecheck and test fixes for fraction contacts"
```
