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
