# CSV Import Tickets — Design

## Goal

Allow admins to bulk-import tickets from CSV files (exported from spreadsheets) into the Zelus ticket system. AI-powered column matching handles any CSV structure.

## Route

`/admin/import-tickets` — new admin route, protected by `orgAdminMiddleware`.

## User Flow (3 Steps)

### Step 1 — Upload

- Drag-and-drop zone or file picker accepting `.csv` files
- Parse CSV client-side with **Papa Parse**
- Show error if file is empty or unparseable

### Step 2 — AI Column Mapping

- Send CSV headers to a server action (`/api/import-tickets/map-columns`)
- Server calls **Claude Haiku** to suggest mappings from CSV headers to ticket fields
- Ticket fields available for mapping:
  - **Title** (required) — maps to `tickets.title`
  - **Description** (optional) — maps to `tickets.description`
  - **Status** (optional) — maps to `tickets.status` with status translation
  - **Category** (optional) — maps to `tickets.category`
  - **Priority** (optional) — maps to `tickets.priority`
- Unmapped columns (e.g., "Observado por", "Resolvido por") → stored as a comment on the ticket
- Admin sees suggested mappings in dropdowns and can adjust before proceeding

### Step 3 — Preview & Import

- Table showing all rows with mapped values
- Validation: rows missing a title are flagged as warnings
- Status translation applied:
  - empty → `open`
  - "Em Curso" → `in_progress`
  - "Notificado" → `in_progress`
  - "Resolvido" → `resolved`
  - Unknown → `open` (with warning)
- "Import" button submits to server action
- Results summary: "X tickets created, Y skipped"

## Server Action — Bulk Create

- Receives array of mapped ticket objects
- Wraps all inserts in a DB transaction
- For each row:
  1. Insert into `tickets` (title, description, status, category, priority, orgId, createdBy = admin)
  2. If unmapped columns have values → insert a `ticketComment` with formatted text
  3. Log audit event (`ticket.imported`)
- Return `{ created: number, errors: Array<{ row: number, error: string }> }`

## Tech Stack

- **Papa Parse** — CSV parsing (client-side), new dependency
- **Claude Haiku** via existing `@ai-sdk/anthropic` — column matching
- **shadcn/ui** — Table, Button, Select, Card components
- **Existing services** — `createTicket` from `tickets.server.ts` (or direct DB insert for bulk perf)

## Status Mapping Table

| CSV Value  | Ticket Status    |
| ---------- | ---------------- |
| (empty)    | `open`           |
| Em Curso   | `in_progress`    |
| Notificado | `in_progress`    |
| Resolvido  | `resolved`       |
| (unknown)  | `open` + warning |
