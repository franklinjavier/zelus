# CSV Import Tickets — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to bulk-import tickets from CSV files with AI-powered column matching.

**Architecture:** Client-side CSV parsing with Papa Parse, server-side AI column mapping via Claude Haiku (`generateObject`), preview table with validation, and a server action that bulk-creates tickets + comments in a DB transaction.

**Tech Stack:** Papa Parse (CSV parsing), `@ai-sdk/anthropic` + `ai` SDK (column matching), shadcn/ui (UI), Drizzle ORM (DB), Zod (validation)

---

### Task 1: Install Papa Parse

**Files:**

- Modify: `package.json`

**Step 1: Install papaparse**

Run: `bun add papaparse && bun add -d @types/papaparse`

**Step 2: Verify installation**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "add papaparse for CSV import"
```

---

### Task 2: AI Column Mapping Service

**Files:**

- Create: `app/lib/services/csv-import.server.ts`

**Step 1: Create the column mapping service**

This service uses Claude Haiku via `generateObject` to match CSV headers to ticket fields.

```typescript
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const TICKET_FIELDS = [
  { key: 'title', label: 'Título / Ocorrência', description: 'The ticket title or issue name' },
  {
    key: 'description',
    label: 'Descrição / Detalhes',
    description: 'Detailed description of the issue',
  },
  {
    key: 'status',
    label: 'Estado / Status',
    description: 'Current status (open, in progress, resolved, etc.)',
  },
  { key: 'category', label: 'Categoria', description: 'Ticket category classification' },
  {
    key: 'priority',
    label: 'Prioridade',
    description: 'Urgency level (urgent, high, medium, low)',
  },
] as const

type TicketFieldKey = (typeof TICKET_FIELDS)[number]['key']

const columnMappingSchema = z.object({
  mappings: z.array(
    z.object({
      csvHeader: z.string(),
      ticketField: z.enum(['title', 'description', 'status', 'category', 'priority', 'unmapped']),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

export type ColumnMapping = z.infer<typeof columnMappingSchema>['mappings'][number]

export async function mapColumnsWithAI(csvHeaders: string[]): Promise<ColumnMapping[]> {
  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: columnMappingSchema,
    prompt: `You are mapping CSV column headers to a ticket management system's fields.

CSV headers: ${JSON.stringify(csvHeaders)}

Available ticket fields:
${TICKET_FIELDS.map((f) => `- "${f.key}": ${f.description}`).join('\n')}

Rules:
- Each CSV header should map to exactly one ticket field or "unmapped"
- Each ticket field can only be mapped once (no duplicates)
- "title" is the most important field — map the main issue/occurrence column to it
- Common Portuguese terms: "Ocorrência" = title, "Detalhes" = description, "Estado"/"Status" = status, "Prioridade" = priority
- Columns like "Observado por", "Resolvido por", names of people, dates, notes = "unmapped"
- Set confidence 0.0-1.0 based on how certain you are about the mapping

Return mappings for ALL CSV headers.`,
  })

  return object.mappings
}

const STATUS_MAP: Record<string, 'open' | 'in_progress' | 'resolved' | 'closed'> = {
  '': 'open',
  'em curso': 'in_progress',
  notificado: 'in_progress',
  resolvido: 'resolved',
  resolved: 'resolved',
  open: 'open',
  aberto: 'open',
  fechado: 'closed',
  closed: 'closed',
  in_progress: 'in_progress',
  'in progress': 'in_progress',
}

const PRIORITY_MAP: Record<string, 'urgent' | 'high' | 'medium' | 'low'> = {
  urgente: 'urgent',
  urgent: 'urgent',
  alta: 'high',
  high: 'high',
  média: 'medium',
  media: 'medium',
  medium: 'medium',
  baixa: 'low',
  low: 'low',
}

export function parseStatus(raw: string): 'open' | 'in_progress' | 'resolved' | 'closed' {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'open'
}

export function parsePriority(raw: string): 'urgent' | 'high' | 'medium' | 'low' | null {
  return PRIORITY_MAP[raw.trim().toLowerCase()] ?? null
}
```

**Step 2: Commit**

```bash
git add app/lib/services/csv-import.server.ts
git commit -m "add AI column mapping service for CSV import"
```

---

### Task 3: Bulk Ticket Creation Service

**Files:**

- Modify: `app/lib/services/tickets.server.ts`

**Step 1: Add bulkCreateTickets function**

Add this function to the bottom of `tickets.server.ts`:

```typescript
export async function bulkCreateTickets(
  orgId: string,
  rows: Array<{
    title: string
    description: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    category?: string | null
    priority?: 'urgent' | 'high' | 'medium' | 'low' | null
    comment?: string | null
  }>,
  userId: string,
) {
  const results: Array<{ row: number; ticketId?: string; error?: string }> = []

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const [ticket] = await tx
          .insert(tickets)
          .values({
            orgId,
            title: row.title,
            description: row.description || '',
            status: row.status,
            category: row.category ?? null,
            priority: row.priority ?? null,
            createdBy: userId,
          })
          .returning()

        if (row.comment) {
          await tx.insert(ticketComments).values({
            orgId,
            ticketId: ticket.id,
            userId,
            content: row.comment,
          })
        }

        await logAuditEvent({
          orgId,
          userId,
          action: 'ticket.imported',
          entityType: 'ticket',
          entityId: ticket.id,
          metadata: { title: row.title, source: 'csv_import' },
        })

        results.push({ row: i, ticketId: ticket.id })
      } catch (e) {
        results.push({ row: i, error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }
  })

  return results
}
```

Note: `ticketComments` will need to be imported at the top of the file if not already.

**Step 2: Commit**

```bash
git add app/lib/services/tickets.server.ts
git commit -m "add bulkCreateTickets for CSV import"
```

---

### Task 4: Admin Import Route — Server Action

**Files:**

- Create: `app/routes/_protected+/admin+/import-tickets.tsx`

**Step 1: Create route with loader and action**

The action handles two intents:

1. `map-columns` — receives CSV headers, returns AI column mappings
2. `import` — receives mapped ticket data, bulk-creates tickets

```typescript
import { data } from 'react-router'
import { z } from 'zod'

import { orgContext, userContext } from '~/lib/auth/context'
import { mapColumnsWithAI, parseStatus, parsePriority } from '~/lib/services/csv-import.server'
import { bulkCreateTickets } from '~/lib/services/tickets.server'
import { setToast } from '~/lib/toast.server'
import type { Route } from './+types/import-tickets'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Importar Ocorrências — Zelus' }]
}

const mapColumnsSchema = z.object({
  intent: z.literal('map-columns'),
  headers: z.string(), // JSON array of header strings
})

const importRowSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  status: z.string().default(''),
  category: z.string().default(''),
  priority: z.string().default(''),
  comment: z.string().default(''),
})

const importSchema = z.object({
  intent: z.literal('import'),
  rows: z.string(), // JSON array of row objects
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'map-columns') {
    const headersRaw = formData.get('headers')
    if (typeof headersRaw !== 'string') {
      return data({ error: 'Headers em falta.' }, { status: 400 })
    }

    try {
      const headers = JSON.parse(headersRaw) as string[]
      const mappings = await mapColumnsWithAI(headers)
      return { mappings }
    } catch (e) {
      return data(
        { error: e instanceof Error ? e.message : 'Erro ao mapear colunas.' },
        { status: 500 },
      )
    }
  }

  if (intent === 'import') {
    const rowsRaw = formData.get('rows')
    if (typeof rowsRaw !== 'string') {
      return data({ error: 'Dados em falta.' }, { status: 400 })
    }

    try {
      const rawRows = JSON.parse(rowsRaw) as Array<Record<string, string>>
      const parsed = rawRows.map((r) => importRowSchema.parse(r))

      const tickets = parsed.map((r) => ({
        title: r.title,
        description: r.description,
        status: parseStatus(r.status),
        category: r.category || null,
        priority: parsePriority(r.priority),
        comment: r.comment || null,
      }))

      const results = await bulkCreateTickets(orgId, tickets, user.id)
      const created = results.filter((r) => r.ticketId).length
      const errors = results.filter((r) => r.error)

      return data(
        { created, errors, total: results.length },
        { headers: await setToast(`${created} ocorrências importadas com sucesso.`) },
      )
    } catch (e) {
      return data({ error: e instanceof Error ? e.message : 'Erro ao importar.' }, { status: 500 })
    }
  }

  return data({ error: 'Intent inválido.' }, { status: 400 })
}
```

**Step 2: Commit**

```bash
git add app/routes/_protected+/admin+/import-tickets.tsx
git commit -m "add import-tickets route with server actions"
```

---

### Task 5: Admin Import Route — Client UI

**Files:**

- Modify: `app/routes/_protected+/admin+/import-tickets.tsx` (add component)

**Step 1: Build the 3-step import UI**

Add the default component to the route file. The UI has three steps:

1. **Upload** — file picker with drag-drop zone
2. **Map Columns** — AI-suggested column mapping with adjustable dropdowns
3. **Preview & Import** — table preview with validation, import button, results

The component uses `useFetcher` to call the two action intents without full page navigation.

Key implementation details:

- Use `Papa.parse(file, { header: true })` for client-side CSV parsing
- After parsing, submit headers to `map-columns` fetcher
- Show mapping UI with `<Select>` dropdowns pre-filled with AI suggestions
- Build preview table from parsed data + mappings
- For unmapped columns with values, build a comment string: `"Column: Value"` format
- Submit mapped rows to `import` fetcher
- Show success/error summary

UI components to use (from shadcn/ui):

- `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `Badge` for status/validation indicators

Design notes (from system.md):

- h-10 buttons/inputs (elderly users)
- No text-xs anywhere
- Borders over shadows
- Cobalt blue primary accent for actions
- `text-lg font-semibold tracking-tight` for page title
- `gap-4` between form fields

**Step 2: Check if all needed shadcn components are installed**

Run: `ls app/components/ui/` and verify: button, card, select, table, badge exist.
If any are missing, install with: `bunx shadcn@latest add [component]`

**Step 3: Implement the full component**

This is the largest piece. The component manages state across 3 steps:

- `step`: 1 | 2 | 3
- `csvData`: parsed rows from Papa Parse
- `csvHeaders`: column headers
- `mappings`: AI-suggested + user-adjusted column mappings
- `importResult`: response from import action

**Step 4: Commit**

```bash
git add app/routes/_protected+/admin+/import-tickets.tsx
git commit -m "add CSV import UI with 3-step wizard"
```

---

### Task 6: Add Navigation Link to Admin Dashboard

**Files:**

- Modify: `app/routes/_protected+/admin+/dashboard.tsx`

**Step 1: Add import link to admin dashboard**

Add a `CardLink` to the dashboard that links to the import page, placed below the stats grid or in a new "Tools" section.

```tsx
import { FileImportIcon } from '@hugeicons/core-free-icons'
// ... in the component, after the stats grid:
;<div className="mt-8">
  <h2 className="text-base font-semibold tracking-tight">Ferramentas</h2>
  <div className="mt-3 grid gap-4 sm:grid-cols-4">
    <CardLink to={href('/admin/import-tickets')} className="p-5">
      <div className="flex items-start justify-between">
        <p className="font-medium">Importar CSV</p>
        <HugeiconsIcon
          icon={FileImportIcon}
          size={20}
          strokeWidth={1.5}
          className="text-muted-foreground"
        />
      </div>
      <p className="text-muted-foreground mt-1 text-sm">Importar ocorrências de um ficheiro CSV</p>
    </CardLink>
  </div>
</div>
```

Note: Check that `FileImportIcon` exists in `@hugeicons/core-free-icons`. If not, find a suitable alternative (e.g., `Upload04Icon`, `FileAttachmentIcon`).

**Step 2: Verify the route works**

Run: `bun run dev` and navigate to `/admin/import-tickets`
Expected: Page loads without errors

**Step 3: Commit**

```bash
git add app/routes/_protected+/admin+/dashboard.tsx
git commit -m "add CSV import link to admin dashboard"
```

---

### Task 7: Typecheck and Test

**Files:**

- All modified files

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: PASS with no errors

**Step 2: Run tests**

Run: `bun run test`
Expected: All existing tests pass

**Step 3: Manual testing**

1. Navigate to `/admin` dashboard — verify "Importar CSV" card appears
2. Click it — verify import page loads
3. Upload a CSV file — verify it parses and shows headers
4. Verify AI column mapping suggestions appear
5. Adjust a mapping — verify preview updates
6. Click Import — verify tickets are created
7. Check tickets list — verify imported tickets appear with correct status/details

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: polish CSV import after testing"
```
