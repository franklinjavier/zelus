import { db } from '~/lib/db'
import { documentChunks } from '~/lib/db/schema'
import { sql } from 'drizzle-orm'

import { chunkText } from './chunking'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { updateDocumentStatus } from '~/lib/services/documents'

/**
 * Process a document: fetch text, chunk it, generate embeddings, store chunks.
 * Called after file upload. Runs async (fire-and-forget from the upload action).
 */
export async function processDocument(
  documentId: string,
  orgId: string,
  fileUrl: string,
  _mimeType: string,
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

  const results = await db.execute<{ content: string; similarity: number }>(sql`
    SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM document_chunks
    WHERE org_id = ${orgId}
    AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  return Array.from(results as Iterable<{ content: string; similarity: number }>)
}
