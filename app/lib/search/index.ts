import { ftsProvider } from './fts'
import type { SearchProvider } from './provider'

export { searchTicketsByText } from './fts'
export type { SearchProvider, SearchResult, SearchResults, SearchScope } from './provider'

/**
 * Default search provider. Uses Postgres FTS.
 * BM25 can be swapped in here behind a feature flag if needed.
 */
export const search: SearchProvider = ftsProvider
