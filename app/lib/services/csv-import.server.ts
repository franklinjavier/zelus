import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

import type { ColumnMapping } from '~/lib/csv-import'

export type { ColumnMapping }

const TICKET_FIELDS = [
  { key: 'title', label: 'Título / Ocorrência', description: 'The ticket title or issue name' },
  {
    key: 'description',
    label: 'Descrição / Detalhes',
    description: 'Detailed description of the issue',
  },
  {
    key: 'status',
    label: 'Estado / Status',
    description: 'Current status (open, in progress, resolved, etc.)',
  },
  { key: 'category', label: 'Categoria', description: 'Ticket category classification' },
  {
    key: 'priority',
    label: 'Prioridade',
    description: 'Urgency level (urgent, high, medium, low)',
  },
] as const

const columnMappingSchema = z.object({
  mappings: z.array(
    z.object({
      csvHeader: z.string(),
      ticketField: z.enum(['title', 'description', 'status', 'category', 'priority', 'unmapped']),
      confidence: z.number(),
    }),
  ),
})

export async function mapColumnsWithAI(csvHeaders: string[]): Promise<ColumnMapping[]> {
  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: columnMappingSchema,
    prompt: `You are mapping CSV column headers to a ticket management system's fields.

CSV headers: ${JSON.stringify(csvHeaders)}

Available ticket fields:
${TICKET_FIELDS.map((f) => `- "${f.key}": ${f.description}`).join('\n')}

Rules:
- Each CSV header should map to exactly one ticket field or "unmapped"
- Each ticket field can only be mapped once (no duplicates)
- "title" is the most important field — map the main issue/occurrence column to it
- Common Portuguese terms: "Ocorrência" = title, "Detalhes" = description, "Estado"/"Status" = status, "Prioridade" = priority
- Columns like "Observado por", "Resolvido por", names of people, dates, notes = "unmapped"
- Set confidence 0.0-1.0 based on how certain you are about the mapping

Return mappings for ALL CSV headers.`,
  })

  return object.mappings
}
