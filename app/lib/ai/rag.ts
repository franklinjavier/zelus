import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

import { db } from '~/lib/db'
import { documentChunks } from '~/lib/db/schema'
import { sql } from 'drizzle-orm'

import { chunkText } from './chunking'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { updateDocumentStatus } from '~/lib/services/documents.server'

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
  // Plain text files can be read directly
  if (mimeType === 'text/plain') {
    const response = await fetch(fileUrl)
    return response.text()
  }

  // Everything else (PDF, Word, Excel, images) goes through Claude
  return extractWithClaude(fileUrl, mimeType)
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
            text: `Extract all visible text content from this document and return it as clean Markdown.

Rules:
- Use headings (#, ##, ###) for titles and sections
- Use lists (- or 1.) where appropriate
- Convert tables to Markdown format (| and --- for columns and headers), preserving all values
- Include text from images, scans, headers, footers, and annotations
- If the document contains scanned pages (photos or paper scans), read and transcribe all visible text
- Omit decorative separator lines made of dashes or hyphens ("----------")
- Keep the extracted content in its ORIGINAL language — do NOT translate
- Do NOT add comments, explanations, or any text not present in the original document
- Do NOT wrap the output in markdown code fences (\`\`\`markdown ... \`\`\`)
- Return ONLY the extracted content as Markdown`,
          },
        ],
      },
    ],
  })

  // Clean up common LLM artifacts
  return text
    .replace(/^```(?:markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .replace(/^[-–—\s]{5,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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
      headers: { 'User-Agent': 'Zelus/1.0 (documents indexer)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const html = await response.text()

    // Strip non-content elements before sending to Claude (saves tokens)
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')

    if (!cleaned || cleaned.length < 10) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      messages: [
        {
          role: 'user',
          content: `Extract the main content from this HTML page and return it as clean Markdown.

Rules:
- Use headings (#, ##, ###) for titles and sections
- Use lists (- or 1.) where appropriate
- Convert tables to Markdown format
- Skip navigation, menus, footers, sidebars, cookie banners, and other non-content elements
- Keep the extracted content in its ORIGINAL language — do NOT translate
- Do NOT add comments, explanations, or any text not present in the page
- Do NOT wrap the output in markdown code fences (\`\`\`markdown ... \`\`\`)
- Return ONLY the main content as Markdown

HTML:
${cleaned.slice(0, 50_000)}`,
        },
      ],
    })

    // Clean up common LLM artifacts
    const cleaned2 = text
      .replace(/^```(?:markdown)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (!cleaned2 || cleaned2.length < 10) {
      await updateDocumentStatus(documentId, 'error')
      return
    }

    const chunks = chunkText(cleaned2)
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

  // Neon serverless pool returns { rows: [...] }, postgres-js returns an array directly.
  const rows: Array<{ content: string; similarity: number }> = Array.isArray(results)
    ? results
    : ((results as unknown as { rows: Array<{ content: string; similarity: number }> }).rows ?? [])

  return rows
}
