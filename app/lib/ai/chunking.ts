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
