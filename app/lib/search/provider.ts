export type SearchScope = 'tickets' | 'suppliers' | 'maintenance' | 'knowledge-base'

export interface SearchResult {
  id: string
  scope: SearchScope
  title: string
  description: string
  url: string
  createdAt: Date
  rank: number
}

export interface SearchResults {
  query: string
  results: SearchResult[]
  total: number
}

export interface SearchProvider {
  search(
    orgId: string,
    query: string,
    scopes: SearchScope[],
    userId: string,
  ): Promise<SearchResults>
}
