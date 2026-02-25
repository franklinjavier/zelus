import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

import { db } from '~/lib/db'
import { documentChunks } from '~/lib/db/schema'
import { sql } from 'drizzle-orm'

import { chunkText } from './chunking'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { updateDocumentStatus } from '~/lib/services/documents'

/**
 * Process a document: extract text via Claude, chunk, generate embeddings, store.
 * Runs synchronously (awaited in the action) so it works on Vercel serverless.
 */
export async function processDocument(
  documentId: string,
  orgId: string,
  fileUrl: string,
  mimeType: string,
) {
  try {
    console.log(`[RAG] Extracting text from ${mimeType} (${fileUrl.slice(0, 80)}...)`)
    const text = await extractText(fileUrl, mimeType)
    console.log(`[RAG] Extracted ${text.length} chars`)

    if (!text || text.length < 10) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const chunks = chunkText(text)
    console.log(`[RAG] Split into ${chunks.length} chunks`)

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
      console.log(
        `[RAG] Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`,
      )
    }

    await updateDocumentStatus(documentId, 'ready')
    console.log(`[RAG] Document ${documentId} ready`)
  } catch (error) {
    console.error('[RAG] Error processing document:', error)
    await updateDocumentStatus(documentId, 'error')
  }
}

/**
 * Extract plain text from a document.
 * Sends the file URL to Claude which fetches it directly — zero local memory usage.
 */
async function extractText(fileUrl: string, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractWithClaude(fileUrl, mimeType)
  }

  // Plain text fallback — these are small, safe to fetch locally
  const response = await fetch(fileUrl)
  return response.text()
}

/**
 * Send the file URL to Claude for text extraction.
 * Claude fetches the file directly from Vercel Blob — nothing loaded into our process.
 */
async function extractWithClaude(fileUrl: string, mimeType: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new URL(fileUrl),
            mediaType: mimeType,
          },
          {
            type: 'text',
            text: 'Extraia todo o conteúdo de texto visível neste documento, incluindo texto em imagens, digitalizações, tabelas, cabeçalhos, rodapés e anotações. Se o documento contiver páginas digitalizadas (fotografias ou scans de papel), leia e transcreva todo o texto visível nessas imagens. Quando encontrar tabelas, converta-as para o formato Markdown (usando | e --- para colunas e cabeçalhos), preservando todos os valores e a estrutura de colunas. Omite linhas decorativas compostas apenas por traços ou hífenes (ex: "----------" ou "- - - -") que sejam usadas como separadores visuais — não fazem parte do conteúdo. Para o restante do conteúdo, devolva apenas o texto bruto sem comentários nem formatação adicional.',
          },
        ],
      },
    ],
  })

  // Strip any decorative separator lines the model may have left (e.g. "------")
  return text
    .replace(/^[-–—\s]{5,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  console.log(`[RAG] query embedding dims=${queryEmbedding.length} orgId=${orgId}`)

  const embeddingStr = `[${queryEmbedding.join(',')}]`

  // Diagnostic: count chunks for this org
  const countResult = await db.execute<{ total: string; with_embedding: string }>(sql`
    SELECT COUNT(*) as total, COUNT(embedding) as with_embedding
    FROM document_chunks
    WHERE org_id = ${orgId}
  `)
  const countRow = Array.from(countResult as Iterable<{ total: string; with_embedding: string }>)[0]
  console.log(`[RAG] chunks total=${countRow?.total} with_embedding=${countRow?.with_embedding}`)

  const results = await db.execute<{ content: string; similarity: number }>(sql`
    SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM document_chunks
    WHERE org_id = ${orgId}
    AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  const rows = Array.from(results as Iterable<{ content: string; similarity: number }>)
  console.log(
    `[RAG] search returned ${rows.length} results, top similarity=${rows[0]?.similarity ?? 'n/a'}`,
  )
  return rows
}
