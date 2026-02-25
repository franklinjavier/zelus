# Document Extraction Viewer — Design

**Date:** 2026-02-25
**Status:** Approved

## Problem

Admins upload PDFs (including scanned documents with images) but have no way to verify what text was actually extracted during processing. Without visibility into the extracted content, it is impossible to confirm that the RAG pipeline ingested the document correctly.

## Goal

Add a drawer in the admin documents page that shows the full extracted text for any uploaded document, so admins can confirm extraction succeeded and review the content.

## Approach

Child route drawer using React Router v7 nested routes.

`/admin/documents/:id` is a nested child of `/admin/documents`. The parent renders the list plus an `<Outlet />`. Navigating to a document ID opens a `<Sheet>` over the list. Closing navigates back to the parent. Back button and direct linking work for free.

## Architecture

### New route

`app/routes/_protected+/admin+/documents.$id.tsx`

- Nested child of the existing documents list route
- Loader fetches document + chunks, returns `{ document, fullText }`
- Component renders a `<Sheet>` that is always open; closing navigates to `/admin/documents`

### Parent route change

Add `<Outlet />` to `app/routes/_protected+/admin+/documents.tsx` so the child drawer renders on top of the list.

### Link from list

Each document row gets a link (or button) that navigates to `/admin/documents/:id`.

## Data Flow

1. Loader verifies document belongs to current org — throws 404 if not
2. If `status === 'ready'`: fetch all `document_chunks` for this document ordered by `chunkIndex`, concatenate with `\n\n` separator → `fullText`
3. If `status !== 'ready'`: return `fullText: null`
4. Return `{ document, fullText }`

No client-side polling needed — the parent list already auto-revalidates every 5s while documents are processing.

## UI

`<Sheet>` sliding from the right, `sm:max-w-2xl`.

**Header:** file name + status badge
**Body:**

- `processing` — centered spinner + "A extrair conteúdo…"
- `error` — error icon + "Ocorreu um erro ao processar este documento."
- `ready` — scrollable read-only textarea with `fullText`, monospace font, full height

**Footer:** "Fechar" button navigating back to `/admin/documents`

X button and overlay click also navigate back.

## Out of Scope

- Chunk-by-chunk view
- Re-processing / retry on error
- Client-side polling for processing state
