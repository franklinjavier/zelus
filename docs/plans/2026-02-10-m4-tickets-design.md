# M4 — Tickets (Ocorrências)

Core feature of the condominium management system. Residents file issues, admins and fraction owners manage them through a status workflow with full immutable history.

Reference: PRD §8.1

---

## Decisions

- **Visibility:** All tickets visible to all org members by default. Opt-in `private` flag restricts to creator + their fraction admins + org admins
- **Status transitions:** Flexible — admin/fraction_owner_admin can move to any status. No strict linear flow
- **Priority:** Optional (urgent, high, medium, low, null). Linear-style selector with colored icons
- **Categories:** Admin-managed predefined list (seeded with defaults on org creation)
- **View:** List view grouped by status. Kanban deferred to future milestone
- **Timeline:** Unified chronological feed (comments + status changes + attachments interleaved)
- **File uploads:** Vercel Blob via `@vercel/blob`. Upload UI via `@diceui/file-upload`
- **Row density:** Follow design system (px-5 py-3.5, text-sm minimum, h-10 touch targets) — not Linear-compact

---

## Schema Changes

### New table: `ticket_categories`

```
id          text PK (uuid)
orgId       text FK → organizations.id
label       text NOT NULL
createdAt   timestamp NOT NULL DEFAULT now()
```

Index: `(orgId)`

### New table: `ticket_events`

Immutable status change log for the unified timeline.

```
id          text PK (uuid)
orgId       text FK → organizations.id
ticketId    text FK → tickets.id
userId      text FK → users.id
fromStatus  text (enum: open, in_progress, resolved, closed)
toStatus    text (enum: open, in_progress, resolved, closed)
createdAt   timestamp NOT NULL DEFAULT now()
```

Index: `(ticketId)`

### New columns on `tickets`

| Column       | Type                                  | Default | Notes                            |
| ------------ | ------------------------------------- | ------- | -------------------------------- |
| `categoryId` | text FK → ticket_categories.id        | NULL    | Optional                         |
| `priority`   | text enum (urgent, high, medium, low) | NULL    | NULL = no priority               |
| `private`    | boolean                               | false   | When true, restricted visibility |

---

## Service Layer

### `app/lib/services/ticket-categories.ts`

- `listCategories(orgId)` → all categories for org
- `createCategory(orgId, label, userId)` → insert + audit log
- `deleteCategory(orgId, categoryId, userId)` → block if tickets reference it

### `app/lib/services/tickets.ts`

- `createTicket(orgId, data, userId)` → insert ticket + audit log. Data: `{ title, description, categoryId?, fractionId?, priority?, private? }`
- `listTickets(orgId, userId, filters?)` → tickets visible to user, joined with category/creator/fraction. Respects `private` flag. Filters: status, priority, categoryId, fractionId
- `getTicket(orgId, ticketId, userId)` → single ticket with visibility check (private restriction)
- `updateTicket(orgId, ticketId, data, userId)` → update fields. Only creator or admin can edit
- `updateTicketStatus(orgId, ticketId, newStatus, userId)` → update status + insert `ticket_events` row + audit log. RBAC: org_admin or fraction_owner_admin only

### `app/lib/services/ticket-comments.ts`

- `addComment(orgId, ticketId, content, userId)` → insert comment + audit log
- `getTicketTimeline(orgId, ticketId)` → unified query merging comments + events + attachments, sorted by `createdAt`. Returns discriminated union: `{ type: 'comment' | 'status_change' | 'attachment', ... }`

### `app/lib/services/ticket-attachments.ts`

- `uploadAttachment(orgId, ticketId, commentId?, file, userId)` → upload to Vercel Blob + insert DB row
- `deleteAttachment(orgId, attachmentId, userId)` → delete from Blob + DB. Only uploader or admin

---

## Routes

### `app/routes/_protected+/tickets+/index.tsx` — List

- **Loader:** `listTickets(orgId, userId)` with URL search params for filters
- **UI:** Filter bar (status, priority, category selects). Sections grouped by status: "Em aberto", "Em progresso", "Resolvido", "Fechado" — each with count. Rows: priority icon, title, category badge, fraction badge, date, creator avatar. Click navigates to detail

### `app/routes/_protected+/tickets+/new.tsx` — Create

- **Action:** Zod validate → `createTicket()` → redirect `/tickets/$id`
- **UI:** Title input, description textarea, category select, fraction select (optional), priority selector (Linear-style), private toggle, DiceUI file upload zone

### `app/routes/_protected+/tickets+/$id.tsx` — Detail + Timeline

- **Loader:** `getTicket()` + `getTicketTimeline()` + `listCategories()`
- **Actions:**
  - `intent: 'comment'` → `addComment()`, optionally with file attachments
  - `intent: 'update-status'` → `updateTicketStatus()`
  - `intent: 'update-ticket'` → `updateTicket()`
  - `intent: 'upload'` → `uploadAttachment()`
  - `intent: 'delete-attachment'` → `deleteAttachment()`
- **UI:** Header: title, status badge (clickable dropdown for admins), priority icon, category badge, private indicator. Metadata: creator, fraction, date. Timeline: unified feed. Bottom: comment form with textarea + file upload

### `app/routes/api.upload.ts` — Resource route for file uploads

- POST only, authenticated
- Receives `multipart/form-data`
- Uploads to Vercel Blob, returns `{ url, fileName, fileSize, mimeType }`
- Max 10MB per file
- Accepted types: images, PDFs, common docs (.doc, .docx, .xls, .xlsx)

### `app/routes/_protected+/admin+/categories.tsx` — Category management

- **Loader:** `listCategories(orgId)`
- **Actions:** `intent: 'create'` / `intent: 'delete'`
- **UI:** List + add form. Tab in admin layout alongside Associações and Convites

---

## Ticket Components

All under `app/components/tickets/`:

### `priority-selector.tsx`

Linear-style combobox. Options with colored icons:

- `null` → gray `---` "Sem prioridade"
- `urgent` → red `!` "Urgente"
- `high` → orange `|||` "Alta"
- `medium` → yellow `||` "Média"
- `low` → green `|` "Baixa"

### `status-badge.tsx`

Color-coded badge. Colors:

- `open` → blue "Em aberto"
- `in_progress` → yellow "Em progresso"
- `resolved` → green "Resolvido"
- `closed` → gray "Fechado"

On detail page: clickable, opens dropdown to change status (admin/fraction_owner_admin only).

### `timeline-entry.tsx`

Polymorphic component rendering based on `type`:

- **comment:** Avatar + name + timestamp + content + attachment thumbnails
- **status_change:** Inline muted text ("João alterou o estado para Em progresso")
- **attachment:** File icon + filename + size + download link

---

## RBAC Rules

| Action                     | org_admin | fraction_owner_admin | fraction_member |
| -------------------------- | --------- | -------------------- | --------------- |
| Create ticket              | Yes       | Yes                  | Yes             |
| View tickets (non-private) | All       | All                  | All             |
| View private tickets       | All       | Own fraction's       | Own only        |
| Edit ticket                | All       | Own fraction's       | Own only        |
| Change status              | Yes       | Own fraction's       | No              |
| Comment                    | Yes       | Yes                  | Yes             |
| Upload attachment          | Yes       | Yes                  | Yes             |
| Delete attachment          | All       | Own                  | Own             |
| Manage categories          | Yes       | No                   | No              |

---

## Default Categories (seeded)

- Canalização
- Eletricidade
- Áreas comuns
- Elevador
- Ruído
- Limpeza
- Segurança
- Outro

---

## Implementation Order

| Step | Description                       | Files                                                                                    |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | Schema changes                    | `app/lib/db/schema/tickets.ts`                                                           |
| 2    | DB migration                      | `drizzle-kit generate` + `drizzle-kit migrate`                                           |
| 3    | Install deps                      | `@vercel/blob`, `@diceui/file-upload`                                                    |
| 4    | Category service                  | `app/lib/services/ticket-categories.ts`                                                  |
| 5    | Ticket service                    | `app/lib/services/tickets.ts`                                                            |
| 6    | Comment + timeline service        | `app/lib/services/ticket-comments.ts`                                                    |
| 7    | Attachment service + upload route | `app/lib/services/ticket-attachments.ts`, `app/routes/api.upload.ts`                     |
| 8    | Ticket components                 | `app/components/tickets/priority-selector.tsx`, `status-badge.tsx`, `timeline-entry.tsx` |
| 9    | List page                         | `app/routes/_protected+/tickets+/index.tsx`                                              |
| 10   | Create page                       | `app/routes/_protected+/tickets+/new.tsx`                                                |
| 11   | Detail page                       | `app/routes/_protected+/tickets+/$id.tsx`                                                |
| 12   | Admin categories page             | `app/routes/_protected+/admin+/categories.tsx` + update admin layout tabs                |
| 13   | Sidebar link                      | Add "Ocorrências" to `app/components/layout/app-sidebar.tsx`                             |

---

## Verification

1. `bun run typecheck` passes after each step
2. Manual flow: resident creates ticket → admin changes status → resident comments → admin resolves
3. Private ticket only visible to creator + admins
4. File upload to Vercel Blob works, attachments display in timeline
5. Status changes appear in unified timeline
6. Categories manageable by admin, deletable only when unused
7. Filters work on list page (status, priority, category, fraction)
8. Audit log entries for all mutations
9. All queries scoped by `orgId`
