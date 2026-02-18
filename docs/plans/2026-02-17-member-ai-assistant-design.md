# Member AI Assistant — Design

## Summary

Replace the generic dashboard with a conversational AI assistant powered by Claude API + Vercel AI SDK. Members interact in natural language to create tickets, check status, and query building documentation. Admins get their stats dashboard moved to `/admin/dashboard`.

## Route restructure

| Route              | Content                                       | Access           |
| ------------------ | --------------------------------------------- | ---------------- |
| `/dashboard`       | AI assistant chat                             | Everyone         |
| `/admin/dashboard` | Stats tiles + invite card (current dashboard) | `org_admin` only |
| `/admin/documents` | Upload/manage building documents for RAG      | `org_admin` only |

The main sidebar "Painel" links to `/dashboard` (assistant). The admin sidebar gets a new "Painel" link to `/admin/dashboard`.

## Assistant capabilities (tools)

**Ticket tools:**

- `create_ticket` — collects title, description, category, priority from conversation. Shows confirmation card before creating.
- `list_my_tickets` — returns the member's recent tickets with status.
- `get_ticket_details` — looks up a specific ticket by ID or keyword match.

**Building knowledge tools:**

- `search_documents` — queries the RAG index of admin-uploaded PDFs (building manuals, warranties, house rules, meeting minutes).

**Info tools:**

- `get_building_info` — returns org details, fraction info, supplier contacts.
- `get_my_fractions` — returns the member's fraction details.

System prompt is in Portuguese, sets the tone (helpful building concierge), includes org name and member's fraction for context.

## Chat UI

Built with [AI SDK Elements](https://elements.ai-sdk.dev/) components installed via shadcn registry pattern:

- **Conversation** — message list with scroll management
- **Message** — user/assistant bubbles with streaming support
- **Prompt Input** — text input with send button
- **Confirmation** — inline card for ticket creation approval
- **Suggestion** — quick-action chips on empty state ("Reportar um problema", "Ver as minhas ocorrências", "Consultar regulamento")

Layout: full-height chat filling the dashboard content region. Suggestion chips on empty/first-visit state. Streaming responses render progressively. Confirmation cards inline in chat. Persistent conversation loads from DB on mount via loader.

Styling inherits the Zelus design system automatically (maia style, OKLCH palette, rounded-2xl, Inter font). Customized to match border treatment and radius tokens.

## Data model

### New tables

```
conversations
├── id (text, PK)
├── orgId (text, FK → organization)
├── userId (text, FK → user)
├── title (text, nullable) — auto-generated summary
├── createdAt (timestamp)
└── updatedAt (timestamp)

conversation_messages
├── id (text, PK)
├── conversationId (text, FK → conversations)
├── role (text) — 'user' | 'assistant'
├── content (text)
├── toolCalls (jsonb, nullable) — serialized tool calls/results
├── createdAt (timestamp)

documents
├── id (text, PK)
├── orgId (text, FK → organization)
├── uploadedBy (text, FK → user)
├── fileName (text)
├── fileUrl (text) — Vercel Blob URL
├── fileSize (integer)
├── mimeType (text)
├── createdAt (timestamp)

document_chunks
├── id (text, PK)
├── documentId (text, FK → documents)
├── orgId (text, FK → organization)
├── content (text) — chunk text
├── embedding (vector(1024)) — pgvector
├── chunkIndex (integer)
```

One active conversation per user per org. New messages append to existing conversation. Loader fetches conversation + recent messages (paginated).

## Server architecture

### Chat flow

1. Member types message → `useChat` (AI SDK) sends POST to `/api/chat` resource route
2. Resource route authenticates via middleware, loads conversation, saves user message
3. Calls Claude API with conversation history + tool definitions via AI SDK's `streamText`
4. Tool calls execute server-side using existing service functions (`createTicket`, `getTicket`, `listCategories`, etc.)
5. Confirmation tool pauses — returns confirmation card to client, waits for approval before executing
6. Final assistant message saved to DB

### Key decisions

- `/api/chat` is a React Router resource route (no UI, just action)
- AI SDK `useChat` hook handles client-side message state, streaming, optimistic updates
- Server reuses existing service functions — no duplication
- Conversation history sent to Claude capped at ~20 messages for token control
- System prompt includes org name, member name, fraction info

### RAG flow

1. Admin uploads PDF → resource route chunks text (~500 tokens, with overlap)
2. Each chunk embedded via embedding API
3. Chunks + embeddings stored in `document_chunks` with pgvector
4. `search_documents` tool → cosine similarity query → top 5 chunks returned as context

## Admin documents page

New route `/admin/documents`:

- Card-per-item list of uploaded documents (name, size, date, uploader)
- Upload button → file picker (PDF, Word, Excel)
- Upload: file → Vercel Blob, then chunk + embed in background
- Delete removes file from Blob + chunks from DB
- Flat list, org-scoped, no folder hierarchy

## Dependencies

- `ai` — Vercel AI SDK (streaming, `useChat` hook, tool abstractions)
- `@ai-sdk/anthropic` — Claude provider for AI SDK
- AI SDK Elements components (installed via registry, become source files)
- `pgvector` extension on Neon (already supported)
- Embedding provider TBD (Voyage, OpenAI, or Cohere)

## Non-goals (v1)

- Voice input
- Multi-conversation threads (one conversation per user)
- File attachments in chat messages (use ticket attachments instead)
- Admin using the assistant to manage tickets
