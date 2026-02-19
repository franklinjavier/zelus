import { tool } from 'ai'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

import { createTicket, listTickets, getTicket, updateTicketStatus } from '~/lib/services/tickets'
import { addComment } from '~/lib/services/ticket-comments'
import { searchTicketsByText } from '~/lib/search'
import { listCategories } from '~/lib/services/categories'
import { listSuppliers } from '~/lib/services/suppliers'
import { db } from '~/lib/db'
import { tickets, userFractions, fractions } from '~/lib/db/schema'

export function getAssistantTools(orgId: string, userId: string) {
  return {
    create_ticket: tool({
      description:
        'Criar uma nova ocorrência/ticket. Usar APENAS depois de verificar duplicados e confirmar detalhes com o utilizador.',
      inputSchema: z.object({
        title: z.string().describe('Título curto da ocorrência'),
        description: z.string().describe('Descrição detalhada do problema'),
        category: z.string().optional().describe('Categoria (ex: canalização, eletricidade)'),
        priority: z
          .enum(['urgent', 'high', 'medium', 'low'])
          .optional()
          .describe('Prioridade: urgent, high, medium, low'),
        fractionId: z
          .string()
          .optional()
          .describe('ID da fração/unidade do utilizador (obtido via get_my_fractions)'),
      }),
      execute: async ({ title, description, category, priority, fractionId }) => {
        const ticket = await createTicket(
          orgId,
          { title, description, category, priority, fractionId },
          userId,
        )
        return {
          success: true,
          ticketId: ticket.id,
          ticketUrl: `/tickets/${ticket.id}`,
          title: ticket.title,
          status: ticket.status,
        }
      },
    }),

    search_org_tickets: tool({
      description:
        'Pesquisar ocorrências existentes no condomínio por texto (full-text search). Usar SEMPRE antes de criar uma nova ocorrência para verificar duplicados.',
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            'Termos de pesquisa baseados no problema descrito (ex: "luz garagem", "elevador avariado")',
          ),
      }),
      execute: async ({ query }) => {
        return searchTicketsByText(orgId, query, userId)
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

    update_ticket_status: tool({
      description:
        'Alterar o estado de uma ocorrência do utilizador (ex: reabrir uma ocorrência fechada/resolvida).',
      inputSchema: z.object({
        ticketId: z.string().describe('ID da ocorrência'),
        newStatus: z.enum(['open', 'in_progress', 'resolved', 'closed']).describe('Novo estado'),
      }),
      execute: async ({ ticketId, newStatus }) => {
        // Verify ticket belongs to this user
        const [ticket] = await db
          .select({ createdBy: tickets.createdBy })
          .from(tickets)
          .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
          .limit(1)

        if (!ticket) return { error: 'Ocorrência não encontrada.' }
        if (ticket.createdBy !== userId) {
          return { error: 'Só pode alterar ocorrências criadas por si.' }
        }

        const result = await updateTicketStatus(orgId, ticketId, newStatus, userId)
        if (!result) return { error: 'Erro ao atualizar.' }
        return {
          success: true,
          ticketUrl: `/tickets/${result.id}`,
          title: result.title,
          newStatus: result.status,
        }
      },
    }),

    add_ticket_comment: tool({
      description: 'Adicionar um comentário/atualização a uma ocorrência existente.',
      inputSchema: z.object({
        ticketId: z.string().describe('ID da ocorrência'),
        content: z.string().describe('Conteúdo do comentário'),
      }),
      execute: async ({ ticketId, content }) => {
        // Verify ticket exists in this org
        const [ticket] = await db
          .select({ id: tickets.id })
          .from(tickets)
          .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
          .limit(1)

        if (!ticket) return { error: 'Ocorrência não encontrada.' }

        await addComment(orgId, ticketId, `${content} — via Assistente`, userId)
        return {
          success: true,
          ticketUrl: `/tickets/${ticketId}`,
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
