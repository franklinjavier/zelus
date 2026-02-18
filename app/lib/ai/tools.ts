import { tool } from 'ai'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

import { createTicket, listTickets, getTicket } from '~/lib/services/tickets'
import { listCategories } from '~/lib/services/categories'
import { listSuppliers } from '~/lib/services/suppliers'
import { db } from '~/lib/db'
import { userFractions, fractions } from '~/lib/db/schema'

export function getAssistantTools(orgId: string, userId: string) {
  return {
    create_ticket: tool({
      description:
        'Criar uma nova ocorrência/ticket. Usar APENAS depois de confirmar os detalhes com o utilizador.',
      inputSchema: z.object({
        title: z.string().describe('Título curto da ocorrência'),
        description: z.string().describe('Descrição detalhada do problema'),
        category: z.string().optional().describe('Categoria (ex: canalização, eletricidade)'),
        priority: z
          .enum(['urgent', 'high', 'medium', 'low'])
          .optional()
          .describe('Prioridade: urgent, high, medium, low'),
      }),
      execute: async ({ title, description, category, priority }) => {
        const ticket = await createTicket(orgId, { title, description, category, priority }, userId)
        return {
          success: true,
          ticketId: ticket.id,
          title: ticket.title,
          status: ticket.status,
        }
      },
    }),

    list_my_tickets: tool({
      description: 'Listar as ocorrências recentes do utilizador com o estado atual.',
      inputSchema: z.object({
        status: z
          .enum(['open', 'in_progress', 'resolved', 'closed'])
          .optional()
          .describe('Filtrar por estado'),
      }),
      execute: async ({ status }) => {
        const allTickets = await listTickets(orgId, userId, {
          scope: 'mine',
          status,
        })
        return allTickets.slice(0, 10).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          fractionLabel: t.fractionLabel,
        }))
      },
    }),

    get_ticket_details: tool({
      description: 'Obter detalhes de uma ocorrência específica pelo ID.',
      inputSchema: z.object({
        ticketId: z.string().describe('ID da ocorrência'),
      }),
      execute: async ({ ticketId }) => {
        const ticket = await getTicket(orgId, ticketId, userId)
        if (!ticket) return { error: 'Ocorrência não encontrada.' }
        return {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          createdAt: ticket.createdAt,
          fractionLabel: ticket.fractionLabel,
        }
      },
    }),

    get_building_info: tool({
      description: 'Obter informações gerais do condomínio e fornecedores.',
      inputSchema: z.object({}),
      execute: async () => {
        const [supplierList, categories] = await Promise.all([
          listSuppliers(orgId),
          listCategories(),
        ])
        return {
          categories: categories.map((c) => c.key),
          suppliers: supplierList.map((s) => ({
            name: s.name,
            category: s.category,
            phone: s.phone,
            email: s.email,
          })),
        }
      },
    }),

    get_my_fractions: tool({
      description: 'Obter as frações do utilizador (apartamentos/unidades).',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await db
          .select({
            fractionId: fractions.id,
            label: fractions.label,
            description: fractions.description,
            role: userFractions.role,
          })
          .from(userFractions)
          .innerJoin(fractions, eq(userFractions.fractionId, fractions.id))
          .where(
            and(
              eq(userFractions.orgId, orgId),
              eq(userFractions.userId, userId),
              eq(userFractions.status, 'approved'),
            ),
          )

        return result
      },
    }),

    search_documents: tool({
      description:
        'Pesquisar nos documentos do condomínio (regulamento, atas, manuais, garantias). Usar quando o utilizador tem perguntas sobre regras, procedimentos ou informações do edifício.',
      inputSchema: z.object({
        query: z.string().describe('A pergunta ou termos de pesquisa'),
      }),
      execute: async ({ query }) => {
        const { searchDocumentChunks } = await import('~/lib/ai/rag')
        const results = await searchDocumentChunks(orgId, query)
        if (results.length === 0) {
          return { found: false, message: 'Nenhum documento relevante encontrado.' }
        }
        return {
          found: true,
          chunks: results.map((r) => ({
            content: r.content,
            relevance: Math.round(r.similarity * 100),
          })),
        }
      },
    }),
  }
}
