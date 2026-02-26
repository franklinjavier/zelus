# Knowledge Base + Home Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the documents/RAG feature into a multi-type knowledge base (files, articles, URLs), add a resident-facing browsable page, add a FAQ search scope, and redesign the home page with feature shortcuts and knowledge base highlights.

**Architecture:** All three content types (file, article, url) share the same `documents` + `documentChunks` tables and RAG pipeline. The `/home` page replaces `/dashboard` (which currently just redirects to `/assistant`). A new `/knowledge-base` resident page satisfies PRD §9.3 FAQ scope.

**Tech Stack:** React Router v7, Drizzle ORM, Postgres FTS, pgvector, Vercel Blob, Tailwind + shadcn/ui, `@hugeicons/react`

---

## Task 1: Schema Migration

**Files:**

- Modify: `app/lib/db/schema/documents.ts`
- Create: `app/lib/db/migrations/0014_knowledge-base.sql` (via `bun run db:generate knowledge-base`)

**Step 1: Update the schema**

In `app/lib/db/schema/documents.ts`, replace the `documents` table definition with:

```ts
export const documents = pgTable(
  'documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => user.id),
    type: text('type', { enum: ['file', 'article', 'url'] })
      .notNull()
      .default('file'),
    title: text('title'),
    body: text('body'),
    sourceUrl: text('source_url'),
    fileName: text('file_name'),
    fileUrl: text('file_url'),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    pinnedAt: timestamp('pinned_at'),
    status: text('status', { enum: ['processing', 'ready', 'error'] })
      .notNull()
      .default('processing'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('documents_org_idx').on(t.orgId)],
)
```

Fields made nullable: `fileName`, `fileUrl`, `fileSize`, `mimeType`.
New fields: `type`, `title`, `body`, `sourceUrl`, `pinnedAt`.

**Step 2: Generate migration**

```bash
bun run db:generate knowledge-base
```

Expected: new file `app/lib/db/migrations/0014_knowledge-base.sql` with ALTER TABLE statements adding the new columns.

**Step 3: Preview and apply migration**

```bash
bun run db:migrate
```

Review the SQL preview. Confirm. Expected: migration applies cleanly.

**Step 4: Typecheck**

```bash
bun run typecheck
```

Expected: errors only in `app/lib/services/documents.ts` where `fileName`, `fileUrl`, `fileSize`, `mimeType` are now required in `createDocument()` — we'll fix those in Task 2.

**Step 5: Commit**

```bash
git add app/lib/db/schema/documents.ts app/lib/db/migrations/
git commit -m "feat: expand documents schema for multi-type knowledge base"
```

---

## Task 2: Update Documents Service

**Files:**

- Modify: `app/lib/services/documents.ts`

**Step 1: Update `createDocument` to handle file type only, add new creators**

Replace the full `app/lib/services/documents.ts` with:

```ts
import { eq, and, desc, isNull, isNotNull, or, sql } from 'drizzle-orm'
import { del } from '@vercel/blob'

import { db } from '~/lib/db'
import { documents, documentChunks } from '~/lib/db/schema'
import { logAuditEvent } from './audit'

export async function createDocument(
  orgId: string,
  data: {
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
  },
  userId: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      uploadedBy: userId,
      type: 'file',
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.created',
    entityType: 'document',
    entityId: doc.id,
    metadata: { fileName: data.fileName },
  })

  return doc
}

export async function createArticle(
  orgId: string,
  data: { title: string; body: string },
  userId: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      uploadedBy: userId,
      type: 'article',
      title: data.title,
      body: data.body,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.created',
    entityType: 'document',
    entityId: doc.id,
    metadata: { title: data.title, type: 'article' },
  })

  return doc
}

export async function createUrlEntry(
  orgId: string,
  data: { title: string; sourceUrl: string },
  userId: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      uploadedBy: userId,
      type: 'url',
      title: data.title,
      sourceUrl: data.sourceUrl,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.created',
    entityType: 'document',
    entityId: doc.id,
    metadata: { title: data.title, type: 'url', sourceUrl: data.sourceUrl },
  })

  return doc
}

export async function listDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt))
}

export async function listReadyDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.status, 'ready')))
    .orderBy(desc(documents.createdAt))
}

export async function getKnowledgeBaseHighlights(orgId: string, limit = 6) {
  // Pinned entries first, then most recent, only 'ready' status
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.status, 'ready')))
    .orderBy(
      sql`CASE WHEN ${documents.pinnedAt} IS NOT NULL THEN 0 ELSE 1 END`,
      desc(documents.pinnedAt),
      desc(documents.createdAt),
    )
    .limit(limit)
}

export async function pinDocument(orgId: string, documentId: string, pin: boolean) {
  await db
    .update(documents)
    .set({ pinnedAt: pin ? new Date() : null })
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
}

export async function deleteDocument(orgId: string, documentId: string, userId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) throw new Error('Documento não encontrado.')

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))

  // Only delete from Vercel Blob if it's a file type
  if (doc.fileUrl) {
    await del(doc.fileUrl).catch(() => {})
  }

  const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.deleted',
    entityType: 'document',
    entityId: documentId,
    metadata: { title: doc.title ?? doc.fileName, type: doc.type },
  })

  return deleted
}

export async function updateDocumentStatus(
  documentId: string,
  status: 'processing' | 'ready' | 'error',
) {
  await db.update(documents).set({ status }).where(eq(documents.id, documentId))
}

export async function resetDocumentForReprocessing(orgId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) throw new Error('Documento não encontrado.')

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))
  await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, documentId))

  return doc
}

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

/** Returns display title — falls back to fileName for file type */
export function getDocumentTitle(doc: {
  type: string
  title: string | null
  fileName: string | null
}): string {
  return doc.title ?? doc.fileName ?? 'Sem título'
}

/** Returns a short text preview for display in lists/cards */
export function getDocumentPreview(
  doc: { type: string; body: string | null; sourceUrl: string | null },
  maxChars = 120,
): string {
  if (doc.type === 'article' && doc.body) {
    return doc.body.slice(0, maxChars) + (doc.body.length > maxChars ? '…' : '')
  }
  if (doc.type === 'url' && doc.sourceUrl) {
    return doc.sourceUrl
  }
  return ''
}
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: no errors in `documents.ts`. Errors may appear in route files — those get fixed in later tasks.

**Step 3: Commit**

```bash
git add app/lib/services/documents.ts
git commit -m "feat: add createArticle, createUrlEntry, pinDocument, getKnowledgeBaseHighlights to documents service"
```

---

## Task 3: Extend RAG Pipeline for Articles and URLs

**Files:**

- Modify: `app/lib/ai/rag.ts`

**Step 1: Add `processArticle` and `processUrl` functions to `app/lib/ai/rag.ts`**

Add these two exported functions after the existing `processDocument` function:

```ts
/**
 * Process a free-text article: chunk the body directly, generate embeddings, store.
 */
export async function processArticle(documentId: string, orgId: string, body: string) {
  try {
    if (!body || body.length < 10) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const chunks = chunkText(body)
    const BATCH_SIZE = 20

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const batchEmbeddings = await generateEmbeddings(batch)

      await db.insert(documentChunks).values(
        batch.map((content, j) => ({
          documentId,
          orgId,
          content,
          embedding: `[${batchEmbeddings[j].join(',')}]`,
          chunkIndex: i + j,
        })),
      )
    }

    await updateDocumentStatus(documentId, 'ready')
  } catch (error) {
    console.error('[RAG] Error processing article:', error)
    await updateDocumentStatus(documentId, 'error')
  }
}

/**
 * Process a URL entry: fetch the page, strip HTML, chunk, generate embeddings, store.
 */
export async function processUrl(documentId: string, orgId: string, sourceUrl: string) {
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Zelus/1.0 (knowledge base indexer)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const html = await response.text()
    // Strip HTML tags and collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!text || text.length < 10) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const chunks = chunkText(text)
    const BATCH_SIZE = 20

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const batchEmbeddings = await generateEmbeddings(batch)

      await db.insert(documentChunks).values(
        batch.map((content, j) => ({
          documentId,
          orgId,
          content,
          embedding: `[${batchEmbeddings[j].join(',')}]`,
          chunkIndex: i + j,
        })),
      )
    }

    await updateDocumentStatus(documentId, 'ready')
  } catch (error) {
    console.error('[RAG] Error processing URL:', error)
    await updateDocumentStatus(documentId, 'error')
  }
}
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/lib/ai/rag.ts
git commit -m "feat: add processArticle and processUrl to RAG pipeline"
```

---

## Task 4: Admin Knowledge Base Page

**Files:**

- Modify: `app/routes/_protected+/admin+/documents.tsx`
- Modify: `app/lib/navigation.ts`

This is the largest task. The existing documents page needs to become a tabbed/sectioned knowledge base manager with three creation modes and a pin toggle.

**Step 1: Update navigation label**

In `app/lib/navigation.ts`, change the documents nav entry:

```ts
{ label: 'Base de Conhecimento', to: href('/admin/documents'), icon: ShieldKeyIcon },
```

**Step 2: Rewrite `app/routes/_protected+/admin+/documents.tsx`**

Replace the loader, action, and component. Key changes:

- Import `createArticle`, `createUrlEntry`, `pinDocument` from `~/lib/services/documents`
- Import `processArticle`, `processUrl` from `~/lib/ai/rag`
- Import `getDocumentTitle`, `getDocumentPreview` from `~/lib/services/documents`
- Action handles new intents: `'add-article'`, `'add-url'`, `'pin'`
- UI: page title "Base de Conhecimento", three Drawer triggers (upload file / novo artigo / adicionar URL), pin toggle button on each row
- Row display: show type badge (`Ficheiro` / `Artigo` / `Fonte externa`) and use `getDocumentTitle()`

**Action additions (add alongside existing `upload`, `reprocess`, `delete` intents):**

```ts
if (intent === 'add-article') {
  const title = formData.get('title') as string
  const body = formData.get('body') as string

  if (!title?.trim() || !body?.trim()) {
    return { error: 'Título e conteúdo são obrigatórios.' }
  }

  const doc = await createArticle(orgId, { title: title.trim(), body: body.trim() }, userId)
  const backgroundProcess = context.get(waitUntilContext)
  backgroundProcess(processArticle(doc.id, orgId, body.trim()))
  return { success: true }
}

if (intent === 'add-url') {
  const title = formData.get('title') as string
  const sourceUrl = formData.get('sourceUrl') as string

  if (!title?.trim() || !sourceUrl?.trim()) {
    return { error: 'Título e URL são obrigatórios.' }
  }

  // Basic URL validation
  try {
    new URL(sourceUrl)
  } catch {
    return { error: 'URL inválido.' }
  }

  const doc = await createUrlEntry(
    orgId,
    { title: title.trim(), sourceUrl: sourceUrl.trim() },
    userId,
  )
  const backgroundProcess = context.get(waitUntilContext)
  backgroundProcess(processUrl(doc.id, orgId, sourceUrl.trim()))
  return { success: true }
}

if (intent === 'pin') {
  const documentId = formData.get('documentId') as string
  const pin = formData.get('pin') === 'true'
  await pinDocument(orgId, documentId, pin)
  return { success: true }
}
```

**Type badge component (add inside the file):**

```tsx
const typeBadge = {
  file: { label: 'Ficheiro', className: 'bg-blue-50 text-blue-700' },
  article: { label: 'Artigo', className: 'bg-green-50 text-green-700' },
  url: { label: 'Fonte externa', className: 'bg-purple-50 text-purple-700' },
} as const

function TypeBadge({ type }: { type: 'file' | 'article' | 'url' }) {
  const cfg = typeBadge[type]
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}
```

**Pin toggle (add to each row's action area, before the eye button):**

```tsx
<Form method="post">
  <input type="hidden" name="intent" value="pin" />
  <input type="hidden" name="documentId" value={doc.id} />
  <input type="hidden" name="pin" value={doc.pinnedAt ? 'false' : 'true'} />
  <Button
    type="submit"
    variant="ghost"
    size="icon-sm"
    aria-label={doc.pinnedAt ? 'Desafixar destaque' : 'Fixar no destaque'}
    className={doc.pinnedAt ? 'text-amber-500' : ''}
  >
    <HugeiconsIcon icon={PinIcon} size={16} />
  </Button>
</Form>
```

Use `PinIcon` from `@hugeicons/core-free-icons` (or `Pin01Icon` — check which exists).

**Article creation form (in a Drawer):**

```tsx
// Drawer trigger button: "Novo Artigo"
// Inside DrawerPopup — a simple Form with method="post":
<Form method="post" onSubmit={() => setArticleDrawerOpen(false)}>
  <input type="hidden" name="intent" value="add-article" />
  <div className="flex flex-col gap-4 p-4">
    <div>
      <Label htmlFor="title">Título</Label>
      <Input id="title" name="title" required />
    </div>
    <div>
      <Label htmlFor="body">Conteúdo</Label>
      <Textarea id="body" name="body" rows={8} required />
    </div>
    <Button type="submit">Guardar artigo</Button>
  </div>
</Form>
```

**URL entry form (in a Drawer):**

```tsx
// Drawer trigger button: "Adicionar URL"
// Inside DrawerPopup:
<Form method="post" onSubmit={() => setUrlDrawerOpen(false)}>
  <input type="hidden" name="intent" value="add-url" />
  <div className="flex flex-col gap-4 p-4">
    <div>
      <Label htmlFor="title">Título</Label>
      <Input id="title" name="title" required placeholder="Ex: Regulamento Municipal" />
    </div>
    <div>
      <Label htmlFor="sourceUrl">URL</Label>
      <Input id="sourceUrl" name="sourceUrl" type="url" required placeholder="https://..." />
    </div>
    <Button type="submit">Adicionar</Button>
  </div>
</Form>
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add app/routes/_protected+/admin+/documents.tsx app/lib/navigation.ts
git commit -m "feat: expand admin knowledge base with articles, URLs, and pin toggle"
```

---

## Task 5: Add Knowledge Base FTS Search Scope

**Files:**

- Modify: `app/lib/search/provider.ts`
- Modify: `app/lib/search/fts.ts`
- Modify: `app/routes/_protected+/search.tsx`

**Step 1: Add `knowledge-base` to `SearchScope`**

In `app/lib/search/provider.ts`:

```ts
export type SearchScope = 'tickets' | 'suppliers' | 'maintenance' | 'knowledge-base'
```

**Step 2: Add knowledge-base search to `app/lib/search/fts.ts`**

Add to the `switch` in `searchScope`:

```ts
case 'knowledge-base':
  return searchKnowledgeBase(orgId, query)
```

Add the function:

```ts
async function searchKnowledgeBase(orgId: string, query: string): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      fileName: documents.fileName,
      body: documents.body,
      sourceUrl: documents.sourceUrl,
      createdAt: documents.createdAt,
      rank: sql<number>`ts_rank(
        to_tsvector('portuguese',
          coalesce(${documents.title}, '') || ' ' ||
          coalesce(${documents.fileName}, '') || ' ' ||
          coalesce(${documents.body}, '')
        ),
        websearch_to_tsquery('portuguese', ${query})
      )`.as('rank'),
    })
    .from(documents)
    .where(
      sql`${documents.orgId} = ${orgId}
        AND ${documents.status} = 'ready'
        AND to_tsvector('portuguese',
          coalesce(${documents.title}, '') || ' ' ||
          coalesce(${documents.fileName}, '') || ' ' ||
          coalesce(${documents.body}, '')
        ) @@ websearch_to_tsquery('portuguese', ${query})`,
    )
    .orderBy(sql`rank DESC`)
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    scope: 'knowledge-base' as const,
    title: r.title ?? r.fileName ?? 'Sem título',
    description: r.body ? r.body.slice(0, 200) : (r.sourceUrl ?? ''),
    url: `/knowledge-base/${r.id}`,
    createdAt: r.createdAt,
    rank: r.rank,
  }))
}
```

Add the `documents` import at the top of `fts.ts`:

```ts
import { tickets, suppliers, maintenanceRecords, documents } from '~/lib/db/schema'
```

**Step 3: Add `knowledge-base` scope to the search route**

In `app/routes/_protected+/search.tsx`, update the scopes array:

```ts
const scopes: SearchScope[] = ['tickets', 'suppliers', 'maintenance', 'knowledge-base']
```

Add to `scopeConfig`:

```ts
'knowledge-base': { label: 'Base de Conhecimento', icon: BookOpen01Icon },
```

Import `BookOpen01Icon` (or similar) from `@hugeicons/core-free-icons`.

**Step 4: Typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add app/lib/search/provider.ts app/lib/search/fts.ts app/routes/_protected+/search.tsx
git commit -m "feat: add knowledge-base FTS search scope"
```

---

## Task 6: Resident-Facing Knowledge Base Page

**Files:**

- Create: `app/routes/_protected+/knowledge-base+/_layout.tsx`
- Create: `app/routes/_protected+/knowledge-base+/index.tsx`
- Create: `app/routes/_protected+/knowledge-base+/$id.tsx`
- Modify: `app/lib/navigation.ts`

**Step 1: Create the list page `index.tsx`**

```tsx
import { BookOpen01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Form, Link, href, useNavigation } from 'react-router'

import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { orgContext } from '~/lib/auth/context'
import { listReadyDocuments, getDocumentTitle, getDocumentPreview } from '~/lib/services/documents'
import { EmptyState } from '~/components/layout/empty-state'
import type { Route } from './+types/index'

export function meta() {
  return [{ title: 'Base de Conhecimento — Zelus' }]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  let docs = await listReadyDocuments(orgId)

  if (q) {
    const lower = q.toLowerCase()
    docs = docs.filter(
      (d) =>
        (d.title ?? d.fileName ?? '').toLowerCase().includes(lower) ||
        (d.body ?? '').toLowerCase().includes(lower),
    )
  }

  return { docs, query: q }
}

const typeLabel = {
  file: 'Ficheiro',
  article: 'Artigo',
  url: 'Fonte externa',
} as const

export default function KnowledgeBaseIndex({ loaderData }: Route.ComponentProps) {
  const { docs, query } = loaderData
  const navigation = useNavigation()
  const isSearching = navigation.state === 'loading'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <HugeiconsIcon icon={BookOpen01Icon} size={24} className="text-primary" />
        <h1 className="text-xl font-semibold">Base de Conhecimento</h1>
      </div>

      <Form method="get" className="mb-6">
        <Input name="q" placeholder="Pesquisar..." defaultValue={query} className="h-10" />
      </Form>

      {docs.length === 0 ? (
        <EmptyState icon={BookOpen01Icon} message="Nenhum conteúdo disponível." />
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <Link
              key={doc.id}
              to={href('/knowledge-base/:id', { id: doc.id })}
              className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-1.5 rounded-2xl p-4 ring-1"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{getDocumentTitle(doc)}</span>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {typeLabel[doc.type]}
                </Badge>
              </div>
              {getDocumentPreview(doc) && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {getDocumentPreview(doc)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Create the detail page `$id.tsx`**

```tsx
import { ArrowLeft01Icon, ExternalLinkIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href } from 'react-router'

import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { orgContext } from '~/lib/auth/context'
import { getDocument, getDocumentTitle } from '~/lib/services/documents'
import type { Route } from './+types/$id'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const doc = await getDocument(orgId, params.id)
  if (!doc || doc.status !== 'ready') throw new Response('Not Found', { status: 404 })
  return { doc }
}

const typeLabel = { file: 'Ficheiro', article: 'Artigo', url: 'Fonte externa' } as const

export default function KnowledgeBaseDetail({ loaderData }: Route.ComponentProps) {
  const { doc } = loaderData

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        nativeButton={false}
        render={<Link to={href('/knowledge-base')} />}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        Voltar
      </Button>

      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{getDocumentTitle(doc)}</h1>
        <Badge variant="secondary">{typeLabel[doc.type]}</Badge>
      </div>

      {doc.type === 'article' && doc.body && (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">{doc.body}</div>
      )}

      {doc.type === 'file' && doc.fileUrl && (
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1.5 hover:underline"
        >
          <HugeiconsIcon icon={ExternalLinkIcon} size={16} />
          Abrir ficheiro
        </a>
      )}

      {doc.type === 'url' && doc.sourceUrl && (
        <a
          href={doc.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1.5 hover:underline"
        >
          <HugeiconsIcon icon={ExternalLinkIcon} size={16} />
          {doc.sourceUrl}
        </a>
      )}
    </div>
  )
}
```

**Step 3: Create the layout `_layout.tsx`**

```tsx
import { Outlet } from 'react-router'

export default function KnowledgeBaseLayout() {
  return <Outlet />
}
```

**Step 4: Add to main nav**

In `app/lib/navigation.ts`, add to `mainNav`:

```ts
import { BookOpen01Icon } from '@hugeicons/core-free-icons'

// Add to mainNav array:
{ label: 'Base de Conhecimento', to: href('/knowledge-base'), icon: BookOpen01Icon },
```

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add app/routes/_protected+/knowledge-base+/ app/lib/navigation.ts
git commit -m "feat: add resident-facing knowledge base browsable page"
```

---

## Task 7: Home Page

**Files:**

- Create: `app/routes/_protected+/home.tsx`
- Modify: `app/routes/_protected+/dashboard.tsx`
- Modify: `app/lib/navigation.ts`

**Step 1: Create `app/routes/_protected+/home.tsx`**

```tsx
import {
  AiChat02Icon,
  BookOpen01Icon,
  Search01Icon,
  Ticket02Icon,
  TruckDeliveryIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, href } from 'react-router'
import type { IconSvgElement } from '@hugeicons/react'

import { Badge } from '~/components/ui/badge'
import { orgContext } from '~/lib/auth/context'
import {
  getKnowledgeBaseHighlights,
  getDocumentTitle,
  getDocumentPreview,
} from '~/lib/services/documents'
import type { Route } from './+types/home'

export function meta() {
  return [{ title: 'Início — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const highlights = await getKnowledgeBaseHighlights(orgId, 6)
  return { highlights }
}

const shortcuts: Array<{
  label: string
  description: string
  to: string
  icon: IconSvgElement
}> = [
  {
    label: 'Assistente',
    description: 'Tire dúvidas com o assistente IA',
    to: href('/assistant'),
    icon: AiChat02Icon,
  },
  {
    label: 'Ocorrências',
    description: 'Reporte ou acompanhe problemas',
    to: href('/tickets'),
    icon: Ticket02Icon,
  },
  {
    label: 'Prestadores',
    description: 'Contactos de fornecedores',
    to: href('/suppliers'),
    icon: TruckDeliveryIcon,
  },
  {
    label: 'Intervenções',
    description: 'Histórico de manutenções',
    to: href('/maintenance'),
    icon: WrenchIcon,
  },
  {
    label: 'Base de Conhecimento',
    description: 'Artigos e documentos úteis',
    to: href('/knowledge-base'),
    icon: BookOpen01Icon,
  },
  {
    label: 'Pesquisa',
    description: 'Pesquise em todo o conteúdo',
    to: href('/search'),
    icon: Search01Icon,
  },
]

const typeLabel = { file: 'Ficheiro', article: 'Artigo', url: 'Fonte externa' } as const

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { highlights } = loaderData

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">Início</h1>

      {/* Feature shortcuts */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3 @sm:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-2 rounded-2xl p-4 ring-1"
            >
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                <HugeiconsIcon icon={s.icon} size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-muted-foreground text-xs">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Knowledge base highlights */}
      {highlights.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Destaques</h2>
            <Link to={href('/knowledge-base')} className="text-primary text-sm hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {highlights.map((doc) => (
              <Link
                key={doc.id}
                to={href('/knowledge-base/:id', { id: doc.id })}
                className="ring-foreground/5 hover:bg-muted/50 flex flex-col gap-1 rounded-2xl p-3 ring-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{getDocumentTitle(doc)}</span>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {typeLabel[doc.type]}
                  </Badge>
                </div>
                {getDocumentPreview(doc) && (
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {getDocumentPreview(doc)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

**Step 2: Update `app/routes/_protected+/dashboard.tsx` to redirect to `/home`**

```ts
import { href, redirect } from 'react-router'
import type { Route } from './+types/dashboard'

export async function loader(_args: Route.LoaderArgs) {
  throw redirect(href('/home'))
}
```

**Step 3: Update navigation in `app/lib/navigation.ts`**

Add `/home` to `mainNav` at the top (or keep it out of nav if home is only accessed via logo/brand link — your call). Also update `extraNav` or brand link references if needed.

Check `app/components/layout/` for the logo/brand link that might point to `/dashboard` — update any such links to `/home`.

**Step 4: Update all remaining `/dashboard` references**

```bash
grep -rn "href('/dashboard')\|'/dashboard'" app/ --include="*.tsx" --include="*.ts"
```

For each hit:

- `app/components/brand/error-page.tsx` — change to `href('/home')`
- `app/routes/join.$code.tsx` — change to `href('/home')`
- `app/routes/_auth+/login.tsx` — change both occurrences to `href('/home')`
- `app/routes/_auth+/_layout.tsx` — change to `href('/home')`
- `app/routes/api.switch-org.ts` — change to `href('/home')`
- `app/routes/onboarding+/_layout.tsx` (x2) — change to `href('/home')`
- `app/routes/onboarding+/done.tsx` — change to `href('/home')`
- `app/routes/invite.$token.tsx` — change to `href('/home')`
- `app/lib/navigation.ts` — keep `/admin/dashboard` as-is (that's the admin dashboard, not the same)

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add app/routes/_protected+/home.tsx app/routes/_protected+/dashboard.tsx app/lib/navigation.ts app/components/ app/routes/
git commit -m "feat: add /home page with shortcuts and knowledge base highlights, redirect /dashboard"
```

---

## Task 8: Final Verification

**Step 1: Full typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 2: Run tests**

```bash
bun run test
```

Expected: all pass.

**Step 3: Build check**

```bash
bun run build
```

Expected: clean build.

**Step 4: Manual smoke test checklist**

- [ ] `/admin/documents` loads and shows "Base de Conhecimento" title
- [ ] Can create an article (title + body), entry appears with "Artigo" badge
- [ ] Can add a URL entry, status goes to processing then ready/error
- [ ] Pin toggle works: pinned entry shows amber pin icon
- [ ] `/knowledge-base` lists all ready entries, search filters them
- [ ] `/knowledge-base/:id` shows article body / file link / URL link correctly
- [ ] `/home` shows 6 shortcut cards and highlights section
- [ ] Highlights show pinned entries first
- [ ] `/dashboard` redirects to `/home`
- [ ] `/search` returns knowledge-base results
- [ ] AI assistant still works (RAG uses same chunks)
