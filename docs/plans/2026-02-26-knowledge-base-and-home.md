# Design: Documents + Home Page

**Date:** 2026-02-26
**Status:** Approved

---

## 1. Context

The PRD (§9.3) requires a FAQ search scope. The current `documents` feature only supports file uploads (PDFs/text) for the AI assistant's RAG pipeline. This design expands the Documents to support multiple content types and adds a resident-facing browsable page, while also redesigning the `/dashboard` home page for better usability — particularly for elderly, non-technical residents.

---

## 2. Documents (Documentos)

### 2.1 Admin Section

Rename **Admin > Documentos → Admin > Documentos** (URL: `/admin/documents`, or keep `/admin/documents` and update labels only).

Three content types managed from the same admin section:

| Type      | Admin action                                | Processing                                                      |
| --------- | ------------------------------------------- | --------------------------------------------------------------- |
| `file`    | Upload PDF or text file (current behaviour) | Claude extracts text → chunk → embed                            |
| `article` | Write title + body (plain text/markdown)    | Chunk + embed directly (no extraction needed)                   |
| `url`     | Paste URL + title                           | Fetch page → extract text → chunk → embed; error if fetch fails |

All three types share the same `documents` + `documentChunks` tables and the same RAG pipeline. Zero duplication.

The admin can also **pin** any entry to the home page highlights using a pin/unpin toggle on each row.

### 2.2 Schema Changes

`documents` table additions:

| Column      | Type                             | Notes                                                                                   |
| ----------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `type`      | `enum('file', 'article', 'url')` | Default `'file'` for backward compat                                                    |
| `title`     | `text`, nullable                 | Free text; required for `article`/`url`, optional for `file` (falls back to `fileName`) |
| `body`      | `text`, nullable                 | Only for `article` type                                                                 |
| `sourceUrl` | `text`, nullable                 | Only for `url` type                                                                     |
| `pinnedAt`  | `timestamp`, nullable            | Set when admin pins the entry                                                           |

Existing `fileUrl`, `fileSize`, `mimeType` become nullable (null for `article` and `url` types).

### 2.3 RAG Pipeline

- `file` → existing `processDocument()` unchanged
- `article` → new `processArticle()`: skip extraction, chunk `body` directly, embed
- `url` → new `processUrl()`: fetch URL, extract visible text (strip HTML), then same as article

### 2.4 Resident-Facing Page

New route: `/documents`

- Paginated list with FTS search across titles and content
- Each card: title, type badge (`Ficheiro` / `Artigo` / `Fonte externa`), content preview
- Clicking a `file` entry opens the file; `article` expands inline or opens a detail page; `url` links to source
- Scoped by `org_id` and only shows `status = 'ready'` entries
- This satisfies the PRD §9.3 FAQ search scope

---

## 3. Home Page

### 3.1 Route

Rename `/dashboard` → `/home`. Add a redirect from `/dashboard` to `/home` for backward compatibility.

### 3.2 Layout

Two zones, same for all roles (org_admin, fraction_owner_admin, fraction_member):

**Zone 1 — Feature Shortcuts (grid)**

Cards linking to the main app sections:

- Assistente IA (`/assistant`)
- Ocorrências (`/tickets`)
- Prestadores (`/suppliers`)
- Documentos (`/documents`)
- Manutenções (`/maintenance`)
- Pesquisa (`/search`)

Each card: icon, label, brief description. No counters or operational state (that lives in the admin dashboard).

**Zone 2 — Documents Highlights**

Shows up to 4–6 entries:

1. Pinned entries first (ordered by `pinnedAt` desc)
2. Most recent non-pinned entries fill remaining slots (ordered by `createdAt` desc)

Each highlight: title, type badge, first ~120 chars of content. "Ver todos" link to `/documents`.

If no Documents entries exist yet, this zone is hidden (not shown as empty state).

---

## 4. Constraints & Invariants

- All Documents entries scoped by `org_id`
- Only `org_admin` can create, edit, delete, pin entries (enforced server-side)
- All roles can read `/documents` and see highlights on `/home`
- Only `status = 'ready'` entries are visible to residents
- URL fetch errors set status to `error` (same as file processing errors)
- Pinning does not change `status` — a pinned entry in `error` state is not shown on home

---

## 5. Out of Scope

- AI-generated summaries of documents (risk of hallucination)
- Resident-contributed FAQ entries
- Version history of articles
- Scheduling or expiry of pinned entries
