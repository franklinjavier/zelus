# Document Extraction Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a drawer at `/admin/documents/:id` that shows the full extracted text for any uploaded document so admins can verify PDF extraction.

**Architecture:** Nested child route `documents.$id.tsx` renders the drawer content (header + text body); parent `documents.tsx` wraps its `<Outlet />` in `<Drawer>` + `<DrawerPopup>`. Two new service functions query document + chunks. No schema changes.

**Tech Stack:** React Router v7 nested routes, Drizzle ORM, `~/components/ui/drawer` (Base UI via `@base-ui/react/drawer`)

---

### Task 1: Add service functions

**Files:**

- Modify: `app/lib/services/documents.ts`

**Step 1: Add two functions after `updateDocumentStatus`**

```typescript
export async function getDocument(orgId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)
  return doc ?? null
}

export async function getDocumentChunks(documentId: string) {
  return db
    .select({ content: documentChunks.content, chunkIndex: documentChunks.chunkIndex })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(documentChunks.chunkIndex)
}
```

Both `documents` and `documentChunks` are already imported at the top of the file.
`and`, `eq` are already imported from `drizzle-orm`.

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add app/lib/services/documents.ts
git commit -m "feat: add getDocument and getDocumentChunks service functions"
```

---

### Task 2: Create the child route

**Files:**

- Create: `app/routes/_protected+/admin+/documents.$id.tsx`

**Step 1: Create the file with this content**

```typescript
import { href, data, useNavigate } from 'react-router'
import { Loading03Icon, Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/documents.$id'
import { orgContext } from '~/lib/auth/context'
import { getDocument, getDocumentChunks } from '~/lib/services/documents'
import {
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '~/components/ui/drawer'
import { Button } from '~/components/ui/button'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc) throw data('Documento não encontrado.', { status: 404 })

  let fullText: string | null = null
  if (doc.status === 'ready') {
    const chunks = await getDocumentChunks(doc.id)
    fullText = chunks.map((c) => c.content).join('\n\n')
  }

  return { doc, fullText }
}

export default function DocumentDetailDrawer({ loaderData }: Route.ComponentProps) {
  const { doc, fullText } = loaderData
  const navigate = useNavigate()

  return (
    <>
      <DrawerHeader>
        <DrawerTitle className="pr-8">{doc.fileName}</DrawerTitle>
        <DrawerDescription>Conteúdo extraído do documento</DrawerDescription>
      </DrawerHeader>

      <div className="px-6 pb-2">
        {doc.status === 'processing' && (
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
            <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin" />
            <span>A extrair conteúdo…</span>
          </div>
        )}

        {doc.status === 'error' && (
          <div className="text-destructive flex flex-col items-center gap-3 py-12 text-sm">
            <HugeiconsIcon icon={Alert02Icon} size={24} />
            <span>Ocorreu um erro ao processar este documento.</span>
          </div>
        )}

        {doc.status === 'ready' && fullText && (
          <pre className="bg-muted text-foreground max-h-[calc(100vh-220px)] overflow-y-auto rounded-lg p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
            {fullText}
          </pre>
        )}

        {doc.status === 'ready' && !fullText && (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nenhum conteúdo extraído.
          </p>
        )}
      </div>

      <DrawerFooter>
        <Button variant="outline" onClick={() => navigate(href('/admin/documents'))}>
          Fechar
        </Button>
      </DrawerFooter>
    </>
  )
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: types generated for the new route, no errors.
If `Route` types are missing, run `bun run typecheck` again (typegen runs first).

**Step 3: Commit**

```bash
git add app/routes/_protected+/admin+/documents.$id.tsx
git commit -m "feat: add document extraction viewer child route"
```

---

### Task 3: Update the parent documents list

**Files:**

- Modify: `app/routes/_protected+/admin+/documents.tsx`

**Step 1: Add missing imports at the top of the file**

Add to the `react-router` import line:

```typescript
import { Form, useRevalidator, useLocation, useNavigate, Outlet, href } from 'react-router'
```

Add a new hugeicons import for the view icon (after the existing icon imports):

```typescript
import { Eye01Icon } from '@hugeicons/core-free-icons'
```

Add drawer imports (new import line):

```typescript
import { Drawer, DrawerPopup } from '~/components/ui/drawer'
```

**Step 2: Add drawer open detection inside the component**

After the existing `const [uploading, setUploading] = useState(false)` line, add:

```typescript
const location = useLocation()
const navigate = useNavigate()
const isDrawerOpen = /\/admin\/documents\/[^/]+$/.test(location.pathname)
```

**Step 3: Add a view button to each document row**

Inside the `documents.map(...)` block, find the `<div className="flex shrink-0 items-center gap-2">` that contains the status badge and delete button.

Add a view icon link button **before** the `DeleteConfirmDialog`, after the status badge:

```tsx
<Button
  variant="ghost"
  size="icon-sm"
  nativeButton={false}
  render={<Link to={href('/admin/documents/:id', { id: doc.id })} />}
  aria-label="Ver conteúdo extraído"
>
  <HugeiconsIcon icon={Eye01Icon} size={16} />
</Button>
```

Also add `import { Link } from 'react-router'` to the react-router import (or add `Link` to the existing import).

**Step 4: Add `<Drawer>` + `<Outlet />` at the bottom of the JSX**

After the closing `</div>` of the `@container` documents list div, add:

```tsx
<Drawer
  open={isDrawerOpen}
  onOpenChange={(open) => {
    if (!open) navigate(href('/admin/documents'))
  }}
>
  <DrawerPopup className="sm:max-w-2xl">
    <Outlet />
  </DrawerPopup>
</Drawer>
```

**Step 5: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 6: Run dev server and manually verify**

```bash
bun run dev
```

1. Go to `/admin/documents`
2. Upload a PDF or check an existing ready document
3. Click the eye icon on a document → drawer should slide open showing extracted text
4. Click X or Fechar → drawer closes, back on list
5. Click eye on a processing document → spinner shown
6. Click eye on an error document → error state shown

**Step 7: Commit**

```bash
git add app/routes/_protected+/admin+/documents.tsx
git commit -m "feat: open extraction viewer drawer from documents list"
```
