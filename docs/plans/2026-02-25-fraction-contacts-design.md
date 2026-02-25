# Fraction Contacts — Design

**Date:** 2026-02-25
**Scope:** Phase 1 (pre-register contacts) + Phase 3 (link to user account)

## Problem

During condo onboarding, the admin has resident data (name, NIF, phone, email) in a spreadsheet
but residents may not have registered in the system yet. There is no way to store this data linked
to a fraction before the resident creates an account.

## Solution

A `fraction_contacts` table stores the admin's contact records for residents, independent of user
accounts. When a resident registers, the admin links their account to the pre-existing contact.
Linking also creates an approved `user_fractions` association giving the resident system access.

## Data Model

```sql
fraction_contacts (
  id          text PRIMARY KEY,
  org_id      text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  fraction_id text NOT NULL REFERENCES fractions(id) ON DELETE CASCADE,
  name        text NOT NULL,
  nif         text,
  mobile      text,
  phone       text,
  email       text,
  notes       text,
  user_id     text REFERENCES user(id) ON DELETE SET NULL,  -- null until linked
  created_by  text NOT NULL REFERENCES user(id),
  created_at  timestamp NOT NULL,
  updated_at  timestamp NOT NULL,

  CONSTRAINT uq_fraction_contact_user UNIQUE (fraction_id, user_id)
  -- one contact per user per fraction (partial, only when user_id IS NOT NULL)
)

INDEX ON (org_id, fraction_id)
INDEX ON (org_id, user_id) WHERE user_id IS NOT NULL
```

### Design decisions

- `fraction_contacts` is the single source of truth for admin-held contact data (NIF, phone, etc.).
  These are not copied to the `user` table — they represent the admin's record of the resident,
  which may differ from what the user fills in on their own profile.
- `user_id` is set null on user deletion (SET NULL), preserving the contact record.
- A user can be linked to contacts in multiple fractions (one per fraction).

## UI

### Fraction detail page (`/fractions/:id`)

New **Contactos** section below the Membros section, visible to `org_admin` only.

```
Contactos  3                              [Adicionar contacto]
┌─────────────────────────────────────────────────────────────┐
│ João Silva                                                   │
│ joao@email.com · 962 xxx xxx · NIF 123456789                 │
│                                  [Editar]  [Associar conta]  │
├─────────────────────────────────────────────────────────────┤
│ Maria Santos                          ● Conta associada      │
│ maria@email.com                                              │
│                                  [Editar]  [Desassociar]     │
└─────────────────────────────────────────────────────────────┘
```

- Unlinked contacts show "Associar conta" button
- Linked contacts show "Conta associada" badge and "Desassociar" button
- Contacts stay in the Contactos section regardless of link status (distinct from Membros, which
  represents system access via `user_fractions`)

### Contact form fields

| Field     | Required |
| --------- | -------- |
| Nome      | Yes      |
| Email     | No       |
| Telemóvel | No       |
| Telefone  | No       |
| NIF       | No       |
| Notas     | No       |

## Routes

| Route                                    | Purpose                      |
| ---------------------------------------- | ---------------------------- |
| `fractions/$id/contacts/new`             | Drawer — create contact      |
| `fractions/$id/contacts/$contactId/edit` | Drawer — edit contact        |
| `fractions/$id/contacts/$contactId/link` | Drawer — select user to link |

Delete and unlink are inline actions on the layout (no dedicated route, with confirmation dialog).

## Linking flow (Phase 3)

1. Admin clicks "Associar conta" on a contact
2. Drawer opens with a list of org members not yet linked to a contact in this fraction
3. Admin selects a user and submits
4. Two things happen atomically:
   - `fraction_contacts.user_id` is set to the selected user
   - An approved `user_fractions` record is created (or existing one updated to approved)

### Unlinking

"Desassociar" removes only `user_id` from the contact (the contact record is preserved).
It does **not** remove the `user_fractions` association — the user retains system access until
the admin explicitly removes them from the Membros section.

## Services

New service file: `app/lib/services/fraction-contacts.ts`

- `createContact(orgId, fractionId, data, adminUserId)`
- `updateContact(orgId, contactId, data, adminUserId)`
- `deleteContact(orgId, contactId, adminUserId)`
- `listFractionContacts(orgId, fractionId)`
- `linkContactToUser(orgId, contactId, userId, adminUserId)` — sets user_id + creates user_fractions
- `unlinkContact(orgId, contactId, adminUserId)` — clears user_id only

## Access control

All contact operations restricted to `org_admin`. `fraction_owner_admin` cannot manage contacts.

## Migration

Single migration: add `fraction_contacts` table with indexes and constraints.
