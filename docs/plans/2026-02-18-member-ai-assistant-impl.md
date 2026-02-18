# Member AI Assistant — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic dashboard with a conversational AI assistant that helps members create tickets, check status, and query building documents, while moving the existing stats dashboard to `/admin/dashboard`.

**Architecture:** React Router v7 resource route (`/api/chat`) handles AI streaming via Vercel AI SDK + Claude. Chat UI uses `useChat` hook with custom components matching the Zelus design system. Conversations persist in Postgres. RAG uses pgvector for document search.

**Tech Stack:** `ai` (Vercel AI SDK), `@ai-sdk/anthropic` (Claude provider), Drizzle ORM (schema + migrations), pgvector (embeddings), React Router v7 resource routes.

**Design doc:** `docs/plans/2026-02-17-member-ai-assistant-design.md`

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install AI SDK packages**

Run:

```bash
bun add ai @ai-sdk/anthropic
```

Expected: packages added to `dependencies` in `package.json`.

**Step 2: Add ANTHROPIC_API_KEY to env**

Add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Note: This is a server-only variable (no `VITE_` prefix). Not committed to git.

**Step 3: Verify dev server starts**

Run: `bun run dev`
Expected: Server starts without errors.

**Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add Vercel AI SDK + Anthropic provider dependencies"
```

---

## Task 2: Route Restructure — Move Dashboard to Admin

**Files:**

- Create: `app/routes/_protected+/admin+/dashboard.tsx`
- Modify: `app/routes/_protected+/dashboard.tsx` (will be replaced in Task 5)
- Modify: `app/components/layout/app-sidebar.tsx`

**Step 1: Create the admin dashboard route**

Copy the current dashboard content to the admin route. The existing file is at `app/routes/_protected+/dashboard.tsx`.

Create `app/routes/_protected+/admin+/dashboard.tsx` with the full content of the current dashboard (stat tiles, invite link card, `useCountUp` hook). Change the meta title to `'Painel Admin — Zelus'`.

Key points:

- This route is already protected by `orgAdminMiddleware` via the admin layout at `app/routes/_protected+/admin+/_layout.tsx`
- Keep all imports identical, just update the `+types` import to `./+types/dashboard`
- Keep `StatTile`, `useCountUp`, and `InviteLinkCard` as-is

**Step 2: Verify admin dashboard loads**

Run: `bun run dev`
Navigate to `/admin/dashboard` — should show the same stats tiles and invite card.

**Step 3: Update sidebar navigation**

Modify `app/components/layout/app-sidebar.tsx`:

1. Add a new icon import for the chat assistant:

```typescript
import { AiChat02Icon } from '@hugeicons/core-free-icons'
```

2. Change the main nav "Painel" entry to use the assistant icon:

```typescript
const mainNav = [
  { label: 'Assistente', to: href('/dashboard'), icon: AiChat02Icon },
  // ... rest unchanged
]
```

3. Add "Painel" as the first item in `adminNav`:

```typescript
const adminNav = [
  { label: 'Painel', to: href('/admin/dashboard') },
  { label: 'Condomínio', to: href('/admin/organization') },
  // ... rest unchanged
]
```

**Step 4: Verify sidebar updates**

Run: `bun run dev`

- Main sidebar should show "Assistente" with chat icon linking to `/dashboard`
- Admin section should show "Painel" as first item linking to `/admin/dashboard`

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: No type errors.

**Step 6: Commit**

```bash
git add app/routes/_protected+/admin+/dashboard.tsx app/components/layout/app-sidebar.tsx
git commit -m "feat: move stats dashboard to /admin/dashboard, update sidebar nav"
```

---

## Task 3: Conversation Data Model

**Files:**

- Create: `app/lib/db/schema/conversations.ts`
- Modify: `app/lib/db/schema/index.ts`

**Step 1: Create the conversation schema**

Create `app/lib/db/schema/conversations.ts`:

```typescript
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

export const conversations = pgTable(
  'conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    title: text('title'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('conversations_org_user_idx').on(t.orgId, t.userId)],
)

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    toolCalls: jsonb('tool_calls'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('conversation_messages_conv_idx').on(t.conversationId)],
)
```

**Step 2: Export from schema index**

Modify `app/lib/db/schema/index.ts` — add:

```typescript
export * from './conversations'
```

**Step 3: Generate the migration**

Run:

```bash
bun run db:generate add-conversations
```

Expected: Migration SQL file created in `app/lib/db/migrations/` with `CREATE TABLE conversations` and `CREATE TABLE conversation_messages`.

**Step 4: Review and apply migration**

Run:

```bash
bun run db:migrate
```

Expected: Migration applied successfully. Preview should show two new tables with indexes.

**Step 5: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add app/lib/db/schema/conversations.ts app/lib/db/schema/index.ts app/lib/db/migrations/
git commit -m "feat: add conversations and conversation_messages tables"
```

---

## Task 4: Conversation Service

**Files:**

- Create: `app/lib/services/conversations.ts`

**Step 1: Create the conversation service**

Create `app/lib/services/conversations.ts`:

```typescript
import { eq, and, desc } from 'drizzle-orm'

import { db } from '~/lib/db'
import { conversations, conversationMessages } from '~/lib/db/schema'

/**
 * Get the user's existing conversation for this org, or create one.
 * Design: one active conversation per user per org.
 */
export async function getOrCreateConversation(orgId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.userId, userId)))
    .limit(1)

  if (existing) return existing

  const [created] = await db.insert(conversations).values({ orgId, userId }).returning()

  return created
}

/**
 * Fetch recent messages for a conversation, ordered oldest-first for Claude context.
 * Capped at `limit` messages for token control.
 */
export async function getRecentMessages(conversationId: string, limit = 20) {
  const rows = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit)

  // Reverse to oldest-first for Claude context
  return rows.reverse()
}

/**
 * Save a message to the conversation.
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: unknown,
) {
  const [msg] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    })
    .returning()

  // Touch conversation updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))

  return msg
}

/**
 * Load full conversation with recent messages for the dashboard loader.
 */
export async function loadConversation(orgId: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.userId, userId)))
    .limit(1)

  if (!conversation) return { conversation: null, messages: [] }

  const messages = await getRecentMessages(conversation.id, 50)

  return { conversation, messages }
}
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/lib/services/conversations.ts
git commit -m "feat: add conversation service (get/create, messages, load)"
```

---

## Task 5: Chat API Route

**Files:**

- Create: `app/routes/api.chat.ts`

**Step 1: Create the chat resource route**

Create `app/routes/api.chat.ts`:

```typescript
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

import type { Route } from './+types/api.chat'
import { sessionContext, orgContext, userContext } from '~/lib/auth/context'
import {
  getOrCreateConversation,
  saveMessage,
  getRecentMessages,
} from '~/lib/services/conversations'
import { getAssistantTools } from '~/lib/ai/tools'
import { buildSystemPrompt } from '~/lib/ai/system-prompt'

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  if (!session?.user) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const org = context.get(orgContext)
  const user = context.get(userContext)

  const { messages } = await request.json()

  // Get or create the single conversation for this user+org
  const conversation = await getOrCreateConversation(org.orgId, user.id)

  // Save the incoming user message
  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user') {
    await saveMessage(conversation.id, 'user', lastMessage.content)
  }

  // Load conversation history from DB (capped at 20 for token control)
  const history = await getRecentMessages(conversation.id, 20)

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: buildSystemPrompt(org.orgName, user.name),
    messages: history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    tools: getAssistantTools(org.orgId, user.id),
    maxSteps: 5,
    onFinish: async ({ text }) => {
      if (text) {
        await saveMessage(conversation.id, 'assistant', text)
      }
    },
  })

  return result.toDataStreamResponse()
}
```

**Step 2: Create the system prompt**

Create `app/lib/ai/system-prompt.ts`:

```typescript
export function buildSystemPrompt(orgName: string, userName: string): string {
  return `Você é o assistente virtual do condomínio "${orgName}". O seu nome é Zelus.

Você ajuda os moradores com questões do dia-a-dia do condomínio:
- Criar ocorrências (tickets) para reportar problemas
- Consultar o estado das suas ocorrências
- Responder a perguntas sobre o regulamento e documentos do edifício
- Fornecer informações sobre o condomínio

Está a falar com ${userName}.

Regras:
- Responda sempre em português de Portugal (pt-PT)
- Seja cordial, profissional e prestável — como um porteiro simpático
- Use linguagem simples e acessível (os utilizadores podem ser idosos)
- Quando criar uma ocorrência, confirme os detalhes com o utilizador antes de submeter
- Mantenha as respostas concisas mas completas
- Se não souber a resposta, diga honestamente que não tem essa informação`
}
```

**Step 3: Create the tools module (stub)**

Create `app/lib/ai/tools.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'

import { createTicket, listTickets, getTicket } from '~/lib/services/tickets'
import { listCategories } from '~/lib/services/categories'

export function getAssistantTools(orgId: string, userId: string) {
  return {
    create_ticket: tool({
      description:
        'Criar uma nova ocorrência/ticket. Usar APENAS depois de confirmar os detalhes com o utilizador.',
      parameters: z.object({
        title: z.string().describe('Título curto da ocorrência'),
        description: z.string().describe('Descrição detalhada do problema'),
        category: z.string().optional().describe('Categoria (ex: canalização, eletricidade)'),
        priority: z
          .enum(['urgent', 'high', 'medium', 'low'])
          .optional()
          .describe('Prioridade: urgent, high, medium, low'),
      }),
      execute: async ({ title, description, category, priority }) => {
        const ticket = await createTicket(orgId, { title, description, category, priority }, userId)
        return {
          success: true,
          ticketId: ticket.id,
          title: ticket.title,
          status: ticket.status,
        }
      },
    }),

    list_my_tickets: tool({
      description: 'Listar as ocorrências recentes do utilizador com o estado atual.',
      parameters: z.object({
        status: z
          .enum(['open', 'in_progress', 'resolved', 'closed'])
          .optional()
          .describe('Filtrar por estado'),
      }),
      execute: async ({ status }) => {
        const tickets = await listTickets(orgId, userId, {
          scope: 'mine',
          status,
        })
        return tickets.slice(0, 10).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          fractionLabel: t.fractionLabel,
        }))
      },
    }),

    get_ticket_details: tool({
      description: 'Obter detalhes de uma ocorrência específica pelo ID.',
      parameters: z.object({
        ticketId: z.string().describe('ID da ocorrência'),
      }),
      execute: async ({ ticketId }) => {
        const ticket = await getTicket(orgId, ticketId, userId)
        if (!ticket) return { error: 'Ocorrência não encontrada.' }
        return {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          createdAt: ticket.createdAt,
          fractionLabel: ticket.fractionLabel,
        }
      },
    }),

    get_building_info: tool({
      description: 'Obter informações gerais do condomínio e fornecedores.',
      parameters: z.object({}),
      execute: async () => {
        const { listSuppliers } = await import('~/lib/services/suppliers')
        const suppliers = await listSuppliers(orgId)
        const categories = await listCategories()
        return {
          categories: categories.map((c) => c.key),
          suppliers: suppliers.map((s) => ({
            name: s.name,
            category: s.category,
            phone: s.phone,
            email: s.email,
          })),
        }
      },
    }),

    get_my_fractions: tool({
      description: 'Obter as frações do utilizador (apartamentos/unidades).',
      parameters: z.object({}),
      execute: async () => {
        const { eq, and } = await import('drizzle-orm')
        const { db } = await import('~/lib/db')
        const { userFractions, fractions } = await import('~/lib/db/schema')

        const result = await db
          .select({
            fractionId: fractions.id,
            label: fractions.label,
            description: fractions.description,
            role: userFractions.role,
          })
          .from(userFractions)
          .innerJoin(fractions, eq(userFractions.fractionId, fractions.id))
          .where(
            and(
              eq(userFractions.orgId, orgId),
              eq(userFractions.userId, userId),
              eq(userFractions.status, 'approved'),
            ),
          )

        return result
      },
    }),
  }
}
```

**Step 4: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add app/routes/api.chat.ts app/lib/ai/system-prompt.ts app/lib/ai/tools.ts
git commit -m "feat: add /api/chat resource route with Claude streaming + assistant tools"
```

---

## Task 6: Chat UI — Dashboard Page

**Files:**

- Modify: `app/routes/_protected+/dashboard.tsx` (replace entirely)

**Step 1: Replace dashboard with chat UI**

Replace the content of `app/routes/_protected+/dashboard.tsx` with the chat interface.

The chat UI uses:

- `useChat` from `ai/react` for message state + streaming
- Custom message bubbles matching Zelus design system
- Suggestion chips for empty state
- Full-height layout filling the content area
- Auto-scroll to latest message

```typescript
import { useChat } from 'ai/react'
import { useRef, useEffect } from 'react'
import {
  AiChat02Icon,
  SentIcon,
  Ticket02Icon,
  Search01Icon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { href } from 'react-router'

import type { Route } from './+types/dashboard'
import { orgContext, userContext } from '~/lib/auth/context'
import { loadConversation } from '~/lib/services/conversations'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Assistente — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const org = context.get(orgContext)
  const user = context.get(userContext)

  const { messages } = await loadConversation(org.orgId, user.id)

  return {
    initialMessages: messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    userName: user.name,
  }
}

const suggestions = [
  {
    label: 'Reportar um problema',
    prompt: 'Quero reportar um problema no edifício.',
    icon: Ticket02Icon,
  },
  {
    label: 'Ver as minhas ocorrências',
    prompt: 'Mostra-me as minhas ocorrências recentes.',
    icon: Search01Icon,
  },
  {
    label: 'Consultar regulamento',
    prompt: 'Tenho uma dúvida sobre o regulamento do condomínio.',
    icon: BookOpen01Icon,
  },
]

export default function AssistantPage({ loaderData }: Route.ComponentProps) {
  const { initialMessages, userName } = loaderData
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: href('/api/chat'),
    initialMessages,
  })

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState userName={userName} onSuggestion={(prompt) => append({ role: 'user', content: prompt })} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-4 pb-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} role={message.role} content={message.content} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-xl">
                  <HugeiconsIcon icon={AiChat02Icon} size={16} className="text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="bg-foreground/30 size-2 animate-bounce rounded-full" style={{ animationDelay: '0ms' }} />
                    <span className="bg-foreground/30 size-2 animate-bounce rounded-full" style={{ animationDelay: '150ms' }} />
                    <span className="bg-foreground/30 size-2 animate-bounce rounded-full" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Escreva a sua mensagem..."
            className="bg-muted h-10 flex-1 rounded-4xl px-4 text-sm outline-none ring-1 ring-foreground/10 placeholder:text-muted-foreground focus:ring-primary/40"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <HugeiconsIcon icon={SentIcon} size={18} />
          </Button>
        </form>
      </div>
    </div>
  )
}

function EmptyState({
  userName,
  onSuggestion,
}: {
  userName: string
  onSuggestion: (prompt: string) => void
}) {
  const firstName = userName.split(' ')[0]

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="bg-primary/10 mb-4 flex size-14 items-center justify-center rounded-2xl">
        <HugeiconsIcon icon={AiChat02Icon} size={28} className="text-primary" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">
        Olá, {firstName}!
      </h1>
      <p className="text-muted-foreground mt-1 text-center text-sm">
        Sou o assistente do condomínio. Como posso ajudar?
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSuggestion(s.prompt)}
            className="bg-card hover:bg-primary/[0.03] hover:ring-primary/20 flex items-center gap-2 rounded-4xl px-4 py-2 text-sm font-medium ring-1 ring-foreground/10 transition-all"
          >
            <HugeiconsIcon icon={s.icon} size={16} strokeWidth={2} className="text-primary" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-xl">
          <HugeiconsIcon icon={AiChat02Icon} size={16} className="text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted rounded-tl-sm',
        )}
      >
        {content}
      </div>
    </div>
  )
}
```

**Step 2: Verify the chat page loads**

Run: `bun run dev`
Navigate to `/dashboard` — should show the empty state with greeting and suggestion chips.

**Step 3: Test sending a message**

Click a suggestion chip or type a message. Verify:

- Message appears as user bubble (right-aligned, primary color)
- Loading dots show while waiting for response
- Assistant response streams in (left-aligned, muted background)

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add app/routes/_protected+/dashboard.tsx
git commit -m "feat: replace dashboard with AI assistant chat UI"
```

---

## Task 7: Document Data Model + Migration

**Files:**

- Create: `app/lib/db/schema/documents.ts`
- Modify: `app/lib/db/schema/index.ts`

**Step 1: Create the documents schema**

Create `app/lib/db/schema/documents.ts`:

```typescript
import { pgTable, text, timestamp, integer, index, customType } from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

// pgvector type for embeddings
const vector = customType<{ data: string }>({
  dataType() {
    return 'vector(1024)'
  },
})

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
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    status: text('status', { enum: ['processing', 'ready', 'error'] })
      .notNull()
      .default('processing'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('documents_org_idx').on(t.orgId)],
)

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    chunkIndex: integer('chunk_index').notNull(),
  },
  (t) => [
    index('document_chunks_doc_idx').on(t.documentId),
    index('document_chunks_org_idx').on(t.orgId),
  ],
)
```

**Step 2: Export from schema index**

Modify `app/lib/db/schema/index.ts` — add:

```typescript
export * from './documents'
```

**Step 3: Generate migration**

Run:

```bash
bun run db:generate add-documents
```

Expected: Migration SQL with `CREATE TABLE documents` and `CREATE TABLE document_chunks`.

**Step 4: Manually add pgvector extension to migration**

Open the generated migration file and add at the top (before any CREATE TABLE):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This enables pgvector on the database. Neon already supports it.

**Step 5: Apply migration**

Run:

```bash
bun run db:migrate
```

Expected: Migration applied, tables created.

**Step 6: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 7: Commit**

```bash
git add app/lib/db/schema/documents.ts app/lib/db/schema/index.ts app/lib/db/migrations/
git commit -m "feat: add documents and document_chunks tables with pgvector"
```

---

## Task 8: Document Service + Admin Documents Page

**Files:**

- Create: `app/lib/services/documents.ts`
- Create: `app/routes/_protected+/admin+/documents.tsx`

**Step 1: Create the document service**

Create `app/lib/services/documents.ts`:

```typescript
import { eq, and, desc } from 'drizzle-orm'
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

export async function listDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt))
}

export async function deleteDocument(orgId: string, documentId: string, userId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) throw new Error('Documento não encontrado.')

  // Delete chunks first (cascade should handle this, but be explicit)
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))

  // Delete from Vercel Blob
  await del(doc.fileUrl).catch(() => {})

  // Delete the document record
  const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'document.deleted',
    entityType: 'document',
    entityId: documentId,
    metadata: { fileName: doc.fileName },
  })

  return deleted
}

export async function updateDocumentStatus(
  documentId: string,
  status: 'processing' | 'ready' | 'error',
) {
  await db.update(documents).set({ status }).where(eq(documents.id, documentId))
}
```

**Step 2: Create the admin documents page**

Create `app/routes/_protected+/admin+/documents.tsx`:

```typescript
import { Form, useNavigation } from 'react-router'
import { useState } from 'react'
import {
  File02Icon,
  Upload04Icon,
  Delete02Icon,
  Clock01Icon,
  Tick02Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/documents'
import { orgContext, userContext } from '~/lib/auth/context'
import { listDocuments, createDocument, deleteDocument } from '~/lib/services/documents'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/layout/empty-state'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { ErrorBanner } from '~/components/layout/feedback'
import { formatDate } from '~/lib/format'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Documentos — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const docs = await listDocuments(orgId)
  return { documents: docs }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'upload') {
    const fileUrl = formData.get('fileUrl') as string
    const fileName = formData.get('fileName') as string
    const fileSize = Number(formData.get('fileSize'))
    const mimeType = formData.get('mimeType') as string

    if (!fileUrl || !fileName) {
      return { error: 'Dados do ficheiro em falta.' }
    }

    await createDocument(orgId, { fileName, fileUrl, fileSize, mimeType }, userId)
    return { success: true }
  }

  if (intent === 'delete') {
    const documentId = formData.get('documentId') as string
    try {
      await deleteDocument(orgId, documentId, userId)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar documento.' }
    }
    return { success: true }
  }

  return { error: 'Ação inválida.' }
}

const statusConfig = {
  processing: { icon: Clock01Icon, label: 'A processar', className: 'text-amber-600' },
  ready: { icon: Tick02Icon, label: 'Pronto', className: 'text-emerald-600' },
  error: { icon: Alert02Icon, label: 'Erro', className: 'text-destructive' },
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminDocumentsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { documents } = loaderData
  const navigation = useNavigation()
  const [uploading, setUploading] = useState(false)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Upload to Vercel Blob via existing API
      const uploadForm = new FormData()
      uploadForm.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: uploadForm })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      // Save document record via form action
      const form = document.createElement('form')
      form.method = 'POST'
      form.style.display = 'none'

      const fields = {
        intent: 'upload',
        fileUrl: data.url,
        fileName: data.fileName,
        fileSize: String(data.fileSize),
        mimeType: data.mimeType,
      }

      for (const [key, value] of Object.entries(fields)) {
        const input = document.createElement('input')
        input.name = key
        input.value = value
        form.appendChild(input)
      }

      document.body.appendChild(form)
      form.requestSubmit()
      document.body.removeChild(form)
    } catch {
      // Error handled by actionData
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Documentos</h1>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Button
            variant="default"
            size="lg"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploading}
          >
            <HugeiconsIcon icon={Upload04Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            {uploading ? 'A enviar...' : 'Carregar documento'}
          </Button>
        </div>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {documents.length === 0 ? (
          <EmptyState icon={File02Icon} message="Nenhum documento carregado." />
        ) : (
          documents.map((doc) => {
            const status = statusConfig[doc.status]
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-foreground/5"
              >
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <HugeiconsIcon icon={File02Icon} size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.fileName}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatFileSize(doc.fileSize)} &middot; {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className={cn('flex items-center gap-1 text-sm', status.className)}>
                  <HugeiconsIcon icon={status.icon} size={14} />
                  <span>{status.label}</span>
                </div>
                <DeleteConfirmDialog
                  title="Apagar documento?"
                  description={`Tem a certeza que quer apagar "${doc.fileName}"? Os dados do RAG associados também serão removidos.`}
                >
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="documentId" value={doc.id} />
                  </Form>
                </DeleteConfirmDialog>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

Note: This task needs the `cn` import — add `import { cn } from '~/lib/utils'` at the top.

**Step 3: Add "Documentos" to admin sidebar**

Modify `app/components/layout/app-sidebar.tsx` — add to `adminNav` array:

```typescript
const adminNav = [
  { label: 'Painel', to: href('/admin/dashboard') },
  { label: 'Documentos', to: href('/admin/documents') },
  { label: 'Condomínio', to: href('/admin/organization') },
  // ... rest unchanged
]
```

**Step 4: Verify admin documents page loads**

Run: `bun run dev`
Navigate to `/admin/documents` — should show empty state with upload button.

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add app/lib/services/documents.ts app/routes/_protected+/admin+/documents.tsx app/components/layout/app-sidebar.tsx
git commit -m "feat: add admin documents page with upload and delete"
```

---

## Task 9: RAG Pipeline — Chunking + Embedding + Search Tool

This task adds the document processing pipeline (chunking + embedding) and the `search_documents` tool for the assistant. This is the most complex task — it requires an embedding provider.

**Files:**

- Create: `app/lib/ai/embeddings.ts`
- Create: `app/lib/ai/chunking.ts`
- Create: `app/lib/ai/rag.ts`
- Modify: `app/lib/ai/tools.ts`

**Step 1: Choose and install embedding provider**

The design doc specifies `vector(1024)` dimensions. We'll use Voyage AI (`@ai-sdk/voyage`) which produces 1024-dim embeddings, or alternatively use the AI SDK's built-in `embed` function with any supported provider.

For simplicity, use the `ai` package's `embed` with the Anthropic provider (which supports Voyage models), or use OpenAI embeddings with `text-embedding-3-small` at 1024 dimensions:

```bash
bun add @ai-sdk/openai
```

Add to `.env.local`:

```
OPENAI_API_KEY=sk-...
```

**Step 2: Create the chunking utility**

Create `app/lib/ai/chunking.ts`:

```typescript
/**
 * Split text into overlapping chunks of ~500 tokens (~2000 chars).
 * Simple character-based chunking with paragraph boundary awareness.
 */
export function chunkText(text: string, maxChars = 2000, overlap = 200): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length)

    // Try to break at a paragraph boundary
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n\n', end)
      if (lastNewline > start + maxChars / 2) {
        end = lastNewline
      } else {
        // Fall back to sentence boundary
        const lastPeriod = text.lastIndexOf('. ', end)
        if (lastPeriod > start + maxChars / 2) {
          end = lastPeriod + 1
        }
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end - overlap
    if (start >= text.length) break
  }

  return chunks.filter((c) => c.length > 0)
}
```

**Step 3: Create the embeddings utility**

Create `app/lib/ai/embeddings.ts`:

```typescript
import { embed, embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'

const embeddingModel = openai.embedding('text-embedding-3-small', { dimensions: 1024 })

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text })
  return embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({ model: embeddingModel, values: texts })
  return embeddings
}
```

**Step 4: Create the RAG pipeline**

Create `app/lib/ai/rag.ts`:

```typescript
import { db } from '~/lib/db'
import { documentChunks } from '~/lib/db/schema'
import { eq, sql, and, desc } from 'drizzle-orm'

import { chunkText } from './chunking'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { updateDocumentStatus } from '~/lib/services/documents'

/**
 * Process a document: extract text, chunk it, generate embeddings, store chunks.
 * Called after file upload. Runs async (fire-and-forget from the upload action).
 */
export async function processDocument(
  documentId: string,
  orgId: string,
  fileUrl: string,
  mimeType: string,
) {
  try {
    // Fetch the file content
    const response = await fetch(fileUrl)
    const text = await response.text()

    if (!text.trim()) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    // Chunk the text
    const chunks = chunkText(text)

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks)

    // Store chunks + embeddings
    await db.insert(documentChunks).values(
      chunks.map((content, i) => ({
        documentId,
        orgId,
        content,
        embedding: `[${embeddings[i].join(',')}]`,
        chunkIndex: i,
      })),
    )

    await updateDocumentStatus(documentId, 'ready')
  } catch (error) {
    console.error('Error processing document:', error)
    await updateDocumentStatus(documentId, 'error')
  }
}

/**
 * Search document chunks by semantic similarity using pgvector cosine distance.
 * Returns top `limit` matching chunks for the given org.
 */
export async function searchDocumentChunks(
  orgId: string,
  query: string,
  limit = 5,
): Promise<Array<{ content: string; similarity: number }>> {
  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = `[${queryEmbedding.join(',')}]`

  const results = await db.execute(sql`
    SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM document_chunks
    WHERE org_id = ${orgId}
    AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  return results.rows as Array<{ content: string; similarity: number }>
}
```

**Step 5: Add search_documents tool**

Modify `app/lib/ai/tools.ts` — add the `search_documents` tool to the returned object:

```typescript
search_documents: tool({
  description:
    'Pesquisar nos documentos do condomínio (regulamento, atas, manuais, garantias). Usar quando o utilizador tem perguntas sobre regras, procedimentos ou informações do edifício.',
  parameters: z.object({
    query: z.string().describe('A pergunta ou termos de pesquisa'),
  }),
  execute: async ({ query }) => {
    const { searchDocumentChunks } = await import('~/lib/ai/rag')
    const results = await searchDocumentChunks(orgId, query)
    if (results.length === 0) {
      return { found: false, message: 'Nenhum documento relevante encontrado.' }
    }
    return {
      found: true,
      chunks: results.map((r) => ({
        content: r.content,
        relevance: Math.round(r.similarity * 100),
      })),
    }
  },
}),
```

**Step 6: Trigger document processing after upload**

Modify `app/routes/_protected+/admin+/documents.tsx` — in the upload action, after `createDocument`, add:

```typescript
// Trigger async processing (fire-and-forget)
import { processDocument } from '~/lib/ai/rag'

// After createDocument call:
const doc = await createDocument(orgId, { fileName, fileUrl, fileSize, mimeType }, userId)
processDocument(doc.id, orgId, fileUrl, mimeType).catch(console.error)
```

**Step 7: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 8: Commit**

```bash
git add app/lib/ai/chunking.ts app/lib/ai/embeddings.ts app/lib/ai/rag.ts app/lib/ai/tools.ts app/routes/_protected+/admin+/documents.tsx
git commit -m "feat: add RAG pipeline (chunking, embeddings, search) + search_documents tool"
```

---

## Post-Implementation Verification

After all tasks are complete, verify the full flow:

1. **Dev server**: `bun run dev` — no errors
2. **Typecheck**: `bun run typecheck` — no type errors
3. **Route check**: `/dashboard` shows chat UI, `/admin/dashboard` shows stats
4. **Sidebar**: "Assistente" in main nav, "Painel" + "Documentos" in admin nav
5. **Chat flow**: Send a message → get streaming response from Claude
6. **Tool use**: "Quero reportar um problema" → AI collects info → creates ticket
7. **Tool use**: "Mostra as minhas ocorrências" → AI returns ticket list
8. **Documents**: Upload a PDF → status goes from "processing" to "ready"
9. **RAG**: Ask about building rules → AI searches documents and answers

---

## Deferred Items (v2)

These items are explicitly out of scope for this implementation:

- **Ticket confirmation cards**: Currently the AI confirms via natural language. A future iteration should add inline confirmation cards using AI SDK's tool confirmation pattern.
- **Voice input**: Explicitly a non-goal for v1.
- **Multi-conversation threads**: One conversation per user per org, as specified.
- **PDF text extraction**: The current `processDocument` uses `fetch().text()` which won't extract text from binary PDFs. A future iteration should use a PDF parsing library (like `pdf-parse` or `unpdf`).
- **Embedding cost optimization**: Consider caching embeddings, batching, or using a cheaper embedding model.
