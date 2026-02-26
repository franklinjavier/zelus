import { sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { tickets, suppliers, maintenanceRecords, documents } from '~/lib/db/schema'
import type { SearchProvider, SearchResult, SearchResults, SearchScope } from './provider'

/**
 * Postgres Full-Text Search implementation using Portuguese language config.
 * Uses expression-based tsvector matching with GIN indexes for performance.
 */
export const ftsProvider: SearchProvider = {
  async search(orgId, query, scopes, userId) {
    const trimmed = query.trim()
    if (!trimmed) {
      return { query, results: [], total: 0 }
    }

    const searches = scopes.map((scope) => searchScope(orgId, trimmed, scope, userId))
    const scopeResults = await Promise.all(searches)
    const results = scopeResults
      .flat()
      .sort((a, b) => b.rank - a.rank || b.createdAt.getTime() - a.createdAt.getTime())

    return { query, results, total: results.length }
  },
}

async function searchScope(
  orgId: string,
  query: string,
  scope: SearchScope,
  userId: string,
): Promise<SearchResult[]> {
  switch (scope) {
    case 'tickets':
      return searchTickets(orgId, query, userId)
    case 'suppliers':
      return searchSuppliers(orgId, query)
    case 'maintenance':
      return searchMaintenance(orgId, query)
    case 'knowledge-base':
      return searchKnowledgeBase(orgId, query)
  }
}

/**
 * Search tickets by text using FTS. Returns ticket-specific fields (status, priority, category)
 * useful for duplicate detection and the AI assistant.
 */
export async function searchTicketsByText(
  orgId: string,
  query: string,
  userId: string,
  limit = 10,
) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      category: tickets.category,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(
      sql`${tickets.orgId} = ${orgId}
        AND (${tickets.private} = false OR ${tickets.createdBy} = ${userId})
        AND to_tsvector('portuguese', coalesce(${tickets.title}, '') || ' ' || coalesce(${tickets.description}, ''))
            @@ websearch_to_tsquery('portuguese', ${trimmed})`,
    )
    .orderBy(
      sql`ts_rank(
        to_tsvector('portuguese', coalesce(${tickets.title}, '') || ' ' || coalesce(${tickets.description}, '')),
        websearch_to_tsquery('portuguese', ${trimmed})
      ) DESC`,
    )
    .limit(limit)

  return rows
}

async function searchTickets(
  orgId: string,
  query: string,
  userId: string,
): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      createdAt: tickets.createdAt,
      rank: sql<number>`ts_rank(
        to_tsvector('portuguese', coalesce(${tickets.title}, '') || ' ' || coalesce(${tickets.description}, '')),
        websearch_to_tsquery('portuguese', ${query})
      )`.as('rank'),
    })
    .from(tickets)
    .where(
      sql`${tickets.orgId} = ${orgId}
        AND (${tickets.private} = false OR ${tickets.createdBy} = ${userId})
        AND to_tsvector('portuguese', coalesce(${tickets.title}, '') || ' ' || coalesce(${tickets.description}, ''))
            @@ websearch_to_tsquery('portuguese', ${query})`,
    )
    .orderBy(sql`rank DESC`)
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    scope: 'tickets' as const,
    title: r.title,
    description: r.description.slice(0, 200),
    url: `/tickets/${r.id}`,
    createdAt: r.createdAt,
    rank: r.rank,
  }))
}

async function searchSuppliers(orgId: string, query: string): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      category: suppliers.category,
      notes: suppliers.notes,
      createdAt: suppliers.createdAt,
      rank: sql<number>`ts_rank(
        to_tsvector('portuguese', coalesce(${suppliers.name}, '') || ' ' || coalesce(${suppliers.category}, '') || ' ' || coalesce(${suppliers.notes}, '')),
        websearch_to_tsquery('portuguese', ${query})
      )`.as('rank'),
    })
    .from(suppliers)
    .where(
      sql`${suppliers.orgId} = ${orgId}
        AND to_tsvector('portuguese', coalesce(${suppliers.name}, '') || ' ' || coalesce(${suppliers.category}, '') || ' ' || coalesce(${suppliers.notes}, ''))
            @@ websearch_to_tsquery('portuguese', ${query})`,
    )
    .orderBy(sql`rank DESC`)
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    scope: 'suppliers' as const,
    title: r.name,
    description: [r.category, r.notes?.slice(0, 150)].filter(Boolean).join(' — '),
    url: `/suppliers/${r.id}`,
    createdAt: r.createdAt,
    rank: r.rank,
  }))
}

async function searchMaintenance(orgId: string, query: string): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: maintenanceRecords.id,
      title: maintenanceRecords.title,
      description: maintenanceRecords.description,
      createdAt: maintenanceRecords.createdAt,
      rank: sql<number>`ts_rank(
        to_tsvector('portuguese', coalesce(${maintenanceRecords.title}, '') || ' ' || coalesce(${maintenanceRecords.description}, '')),
        websearch_to_tsquery('portuguese', ${query})
      )`.as('rank'),
    })
    .from(maintenanceRecords)
    .where(
      sql`${maintenanceRecords.orgId} = ${orgId}
        AND to_tsvector('portuguese', coalesce(${maintenanceRecords.title}, '') || ' ' || coalesce(${maintenanceRecords.description}, ''))
            @@ websearch_to_tsquery('portuguese', ${query})`,
    )
    .orderBy(sql`rank DESC`)
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    scope: 'maintenance' as const,
    title: r.title,
    description: r.description.slice(0, 200),
    url: `/maintenance/${r.id}`,
    createdAt: r.createdAt,
    rank: r.rank,
  }))
}

async function searchKnowledgeBase(orgId: string, query: string): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      fileName: documents.fileName,
      body: documents.body,
      sourceUrl: documents.sourceUrl,
      createdAt: documents.createdAt,
      rank: sql<number>`ts_rank(
        to_tsvector('portuguese',
          coalesce(${documents.title}, '') || ' ' ||
          coalesce(${documents.fileName}, '') || ' ' ||
          coalesce(${documents.body}, '')
        ),
        websearch_to_tsquery('portuguese', ${query})
      )`.as('rank'),
    })
    .from(documents)
    .where(
      sql`${documents.orgId} = ${orgId}
        AND ${documents.status} = 'ready'
        AND to_tsvector('portuguese',
          coalesce(${documents.title}, '') || ' ' ||
          coalesce(${documents.fileName}, '') || ' ' ||
          coalesce(${documents.body}, '')
        ) @@ websearch_to_tsquery('portuguese', ${query})`,
    )
    .orderBy(sql`rank DESC`)
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    scope: 'knowledge-base' as const,
    title: r.title ?? r.fileName ?? 'Sem título',
    description: r.body ? r.body.slice(0, 200) : (r.sourceUrl ?? ''),
    url: `/knowledge-base/${r.id}`,
    createdAt: r.createdAt,
    rank: r.rank,
  }))
}
