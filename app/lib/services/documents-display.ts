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
