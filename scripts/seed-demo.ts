/**
 * Rich demo seed — creates a realistic Portuguese condominium with users,
 * fractions, tickets, comments, suppliers, maintenance records, notifications,
 * and a sample AI conversation.
 *
 * Usage: bun run db:seed-demo
 */
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../app/lib/db/schema'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(DATABASE_URL)
const db = drizzle(client, { schema })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function hoursAgo(n: number): Date {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d
}

// ---------------------------------------------------------------------------
// IDs (pre-generated so we can cross-reference)
// ---------------------------------------------------------------------------

const orgId = crypto.randomUUID()

// Users
const mariaId = crypto.randomUUID()
const joaoId = crypto.randomUUID()
const anaId = crypto.randomUUID()
const carlosId = crypto.randomUUID()
const sofiaId = crypto.randomUUID()

// Fractions — indexed by label for easy lookup
const fractionIds: Record<string, string> = {}
const fractionLabels = [
  'T1 – R/C Esq.',
  'T2 – R/C Dir.',
  'T2 – 1º Esq.',
  'T3 – 1º Dir.',
  'T2 – 2º Esq.',
  'T3 – 2º Dir.',
  'T2 – 3º Esq.',
  'T2 – 3º Dir.',
  'T4 – 4º Esq.',
  'T4 – 4º Dir.',
  'T1 – 5º Esq.',
  'T1 – 5º Dir.',
]
for (const label of fractionLabels) {
  fractionIds[label] = crypto.randomUUID()
}

// Suppliers
const supplierSilvaId = crypto.randomUUID()
const supplierElevaTecnicaId = crypto.randomUUID()
const supplierEletricoLuzId = crypto.randomUUID()
const supplierPintaFacilId = crypto.randomUUID()
const supplierPragaZeroId = crypto.randomUUID()
const supplierTelhaSeguraId = crypto.randomUUID()

// Tickets
const ticket1Id = crypto.randomUUID()
const ticket2Id = crypto.randomUUID()
const ticket3Id = crypto.randomUUID()
const ticket4Id = crypto.randomUUID()
const ticket5Id = crypto.randomUUID()
const ticket6Id = crypto.randomUUID()
const ticket7Id = crypto.randomUUID()
const ticket8Id = crypto.randomUUID()

// Conversation
const conversationId = crypto.randomUUID()

const now = new Date()

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seedDemo() {
  console.log('Seeding rich demo data...\n')

  // -------------------------------------------------------------------------
  // 0. Clean up existing data for this org (idempotent re-runs)
  // -------------------------------------------------------------------------
  const existing = await db.query.organization.findFirst({
    where: eq(schema.organization.slug, 'edificio-sao-tome'),
  })

  if (existing) {
    console.log(`Found existing org "${existing.name}" — deleting...`)

    // Delete in dependency order (conversationMessages cascade from conversations)
    await db.delete(schema.conversations).where(eq(schema.conversations.orgId, existing.id))
    await db.delete(schema.notifications).where(eq(schema.notifications.orgId, existing.id))
    await db
      .delete(schema.maintenanceRecords)
      .where(eq(schema.maintenanceRecords.orgId, existing.id))
    await db.delete(schema.ticketAttachments).where(eq(schema.ticketAttachments.orgId, existing.id))
    await db.delete(schema.ticketEvents).where(eq(schema.ticketEvents.orgId, existing.id))
    await db.delete(schema.ticketComments).where(eq(schema.ticketComments.orgId, existing.id))
    await db.delete(schema.tickets).where(eq(schema.tickets.orgId, existing.id))
    await db.delete(schema.suppliers).where(eq(schema.suppliers.orgId, existing.id))
    await db.delete(schema.userFractions).where(eq(schema.userFractions.orgId, existing.id))
    await db.delete(schema.fractions).where(eq(schema.fractions.orgId, existing.id))
    await db.delete(schema.member).where(eq(schema.member.organizationId, existing.id))

    // Delete accounts + users that belong to this org's members
    // We find them via the member table first
    const members = await db.query.member.findMany({
      where: eq(schema.member.organizationId, existing.id),
    })
    for (const m of members) {
      await db.delete(schema.account).where(eq(schema.account.userId, m.userId))
      await db.delete(schema.user).where(eq(schema.user.id, m.userId))
    }

    // Also delete users who have userFractions but no member record (fraction owners)
    const knownEmails = [
      'admin@zelus.sh',
      'joao.ferreira@email.com',
      'ana.oliveira@email.com',
      'carlos.mendes@email.com',
      'sofia.costa@email.com',
    ]
    for (const email of knownEmails) {
      const u = await db.query.user.findFirst({ where: eq(schema.user.email, email) })
      if (u) {
        await db.delete(schema.account).where(eq(schema.account.userId, u.id))
        await db.delete(schema.user).where(eq(schema.user.id, u.id))
      }
    }

    await db.delete(schema.organization).where(eq(schema.organization.id, existing.id))
    console.log('Cleanup complete.\n')
  }

  // -------------------------------------------------------------------------
  // 1. Organization
  // -------------------------------------------------------------------------
  await db.insert(schema.organization).values({
    id: orgId,
    name: 'Edifício São Tomé',
    slug: 'edificio-sao-tome',
    city: 'Lisboa',
    totalFractions: '12',
    notes: 'Rua de São Tomé 42, 1100-465 Lisboa',
    language: 'pt-PT',
    timezone: 'Europe/Lisbon',
    createdAt: daysAgo(90),
    metadata: null,
    logo: null,
  })
  console.log('Created organization: Edifício São Tomé')

  // -------------------------------------------------------------------------
  // 2. Users + Accounts
  // -------------------------------------------------------------------------
  // Hash generated by Better Auth's scrypt-based hashPassword('password123')
  const passwordHash =
    '7b88cfe451278866064befa67491a685:771d43f1f39ddfd1d0b7ad6a984b3a90e6fd79806259ba665612f3b913cfb97e54ec9c33c6bc957252440b0fd96eca0528a2e0326a14d82e027120e7b7e6b165'

  const users = [
    { id: mariaId, name: 'Maria Santos', email: 'admin@zelus.sh', emailVerified: true },
    { id: joaoId, name: 'João Ferreira', email: 'joao.ferreira@email.com', emailVerified: true },
    { id: anaId, name: 'Ana Oliveira', email: 'ana.oliveira@email.com', emailVerified: true },
    { id: carlosId, name: 'Carlos Mendes', email: 'carlos.mendes@email.com', emailVerified: true },
    { id: sofiaId, name: 'Sofia Costa', email: 'sofia.costa@email.com', emailVerified: true },
  ]

  for (const u of users) {
    await db.insert(schema.user).values({
      ...u,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
    })

    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      accountId: u.id,
      providerId: 'credential',
      userId: u.id,
      password: passwordHash,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
    })
  }
  console.log(`Created ${users.length} users with accounts`)

  // -------------------------------------------------------------------------
  // 3. Member record (Maria = org admin)
  // -------------------------------------------------------------------------
  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: mariaId,
    role: 'admin',
    createdAt: daysAgo(90),
  })
  console.log('Created member record for Maria (org admin)')

  // -------------------------------------------------------------------------
  // 4. Fractions
  // -------------------------------------------------------------------------
  for (const label of fractionLabels) {
    await db.insert(schema.fractions).values({
      id: fractionIds[label],
      orgId,
      label,
      createdAt: daysAgo(90),
    })
  }
  console.log(`Created ${fractionLabels.length} fractions`)

  // -------------------------------------------------------------------------
  // 5. User–Fraction associations
  // -------------------------------------------------------------------------
  const userFractionAssocs = [
    {
      userId: mariaId,
      fractionLabel: 'T2 – 2º Esq.',
      role: 'fraction_owner_admin' as const,
      status: 'approved' as const,
    },
    {
      userId: joaoId,
      fractionLabel: 'T3 – 1º Dir.',
      role: 'fraction_owner_admin' as const,
      status: 'approved' as const,
    },
    {
      userId: anaId,
      fractionLabel: 'T2 – 3º Esq.',
      role: 'fraction_member' as const,
      status: 'approved' as const,
    },
    {
      userId: carlosId,
      fractionLabel: 'T2 – R/C Dir.',
      role: 'fraction_member' as const,
      status: 'pending' as const,
    },
    {
      userId: sofiaId,
      fractionLabel: 'T4 – 4º Dir.',
      role: 'fraction_owner_admin' as const,
      status: 'approved' as const,
    },
  ]

  for (const assoc of userFractionAssocs) {
    await db.insert(schema.userFractions).values({
      id: crypto.randomUUID(),
      orgId,
      userId: assoc.userId,
      fractionId: fractionIds[assoc.fractionLabel],
      role: assoc.role,
      status: assoc.status,
      approvedBy: assoc.status === 'approved' ? mariaId : null,
      createdAt: daysAgo(85),
    })
  }
  console.log(`Created ${userFractionAssocs.length} user-fraction associations`)

  // -------------------------------------------------------------------------
  // 6. Categories (idempotent)
  // -------------------------------------------------------------------------
  const categoryKeys = [
    'plumbing',
    'sewage',
    'gas',
    'electricity',
    'common_lighting',
    'elevators',
    'hvac',
    'intercom',
    'security',
    'fire_safety',
    'gardening',
    'cleaning',
    'pest_control',
    'structural',
    'roofing',
    'parking',
    'telecommunications',
    'waste',
    'painting',
    'other',
  ]

  for (const key of categoryKeys) {
    await db.insert(schema.categories).values({ key }).onConflictDoNothing()
  }
  console.log(`Seeded ${categoryKeys.length} categories`)

  // -------------------------------------------------------------------------
  // 7. Suppliers
  // -------------------------------------------------------------------------
  const suppliersData = [
    {
      id: supplierSilvaId,
      name: 'Canalizações Silva, Lda.',
      category: 'plumbing',
      contactName: 'António Silva',
      contactPhone: '912 345 678',
      email: 'geral@canalizacoessilva.pt',
    },
    {
      id: supplierElevaTecnicaId,
      name: 'ElevaTécnica',
      category: 'elevators',
      contactName: 'Rui Marques',
      contactPhone: '913 456 789',
      email: 'info@elevatecnica.pt',
    },
    {
      id: supplierEletricoLuzId,
      name: 'ElétricoLuz',
      category: 'electricity',
      contactName: 'Pedro Nunes',
      contactPhone: '914 567 890',
      email: 'pedro@eletricoluz.pt',
    },
    {
      id: supplierPintaFacilId,
      name: 'PintaFácil',
      category: 'painting',
      contactName: 'Manuel Sousa',
      contactPhone: '915 678 901',
      email: 'orcamentos@pintafacil.pt',
    },
    {
      id: supplierPragaZeroId,
      name: 'PragaZero',
      category: 'pest_control',
      contactName: 'Teresa Lopes',
      contactPhone: '916 789 012',
      email: 'info@pragazero.pt',
    },
    {
      id: supplierTelhaSeguraId,
      name: 'TelhaSegura, Lda.',
      category: 'roofing',
      contactName: 'José Cardoso',
      contactPhone: '917 890 123',
      email: 'jose@telhasegura.pt',
    },
  ]

  for (const s of suppliersData) {
    await db.insert(schema.suppliers).values({
      ...s,
      orgId,
      createdAt: daysAgo(80),
    })
  }
  console.log(`Created ${suppliersData.length} suppliers`)

  // -------------------------------------------------------------------------
  // 8. Tickets
  // -------------------------------------------------------------------------
  const ticketsData = [
    {
      id: ticket1Id,
      title: 'Fuga de água na garagem',
      description:
        'Há uma fuga de água visível na garagem, perto da zona do 1º Dir. A água está a escorrer pela parede.',
      status: 'resolved' as const,
      priority: 'urgent' as const,
      category: 'plumbing',
      createdBy: joaoId,
      fractionId: fractionIds['T3 – 1º Dir.'],
      createdAt: daysAgo(55),
    },
    {
      id: ticket2Id,
      title: 'Elevador parado no 3º andar',
      description:
        'O elevador ficou parado no 3º andar e não responde aos botões. A porta está fechada.',
      status: 'in_progress' as const,
      priority: 'high' as const,
      category: 'elevators',
      createdBy: anaId,
      fractionId: fractionIds['T2 – 3º Esq.'],
      createdAt: daysAgo(10),
    },
    {
      id: ticket3Id,
      title: 'Lâmpada fundida no hall do 2º',
      description:
        'A lâmpada do hall do 2º andar está fundida. O corredor fica muito escuro à noite.',
      status: 'open' as const,
      priority: 'low' as const,
      category: 'common_lighting',
      createdBy: mariaId,
      fractionId: fractionIds['T2 – 2º Esq.'],
      createdAt: daysAgo(5),
    },
    {
      id: ticket4Id,
      title: 'Porta da entrada não fecha',
      description:
        'A porta principal do edifício não fecha corretamente. A fechadura parece estar avariada e qualquer pessoa pode entrar.',
      status: 'open' as const,
      priority: 'medium' as const,
      category: 'security',
      createdBy: sofiaId,
      fractionId: null,
      createdAt: daysAgo(4),
    },
    {
      id: ticket5Id,
      title: 'Infiltração na cobertura',
      description:
        'Com as últimas chuvas, apareceram manchas de humidade no teto do último andar. Possível infiltração pela cobertura.',
      status: 'in_progress' as const,
      priority: 'high' as const,
      category: 'structural',
      createdBy: mariaId,
      fractionId: null,
      createdAt: daysAgo(30),
    },
    {
      id: ticket6Id,
      title: 'Intercomunicador avariado no 1º',
      description:
        'O intercomunicador da fração 1º Dir. não emite som. Não consigo ouvir quem toca à porta.',
      status: 'resolved' as const,
      priority: 'medium' as const,
      category: 'intercom',
      createdBy: joaoId,
      fractionId: fractionIds['T3 – 1º Dir.'],
      createdAt: daysAgo(40),
    },
    {
      id: ticket7Id,
      title: 'Pintura das escadas',
      description:
        'As escadas do 1º ao 3º andar precisam de ser pintadas. A tinta está a descascar em vários pontos.',
      status: 'closed' as const,
      priority: 'low' as const,
      category: 'painting',
      createdBy: mariaId,
      fractionId: null,
      createdAt: daysAgo(60),
    },
    {
      id: ticket8Id,
      title: 'Baratas no pátio interior',
      description:
        'Foram vistas baratas no pátio interior do edifício, especialmente à noite. Peço que seja feita desinfestação.',
      status: 'open' as const,
      priority: 'medium' as const,
      category: 'pest_control',
      createdBy: anaId,
      fractionId: null,
      createdAt: daysAgo(3),
    },
  ]

  for (const t of ticketsData) {
    await db.insert(schema.tickets).values({
      ...t,
      orgId,
    })
  }
  console.log(`Created ${ticketsData.length} tickets`)

  // -------------------------------------------------------------------------
  // 9. Ticket Comments
  // -------------------------------------------------------------------------
  const commentsData = [
    // Ticket 1: Fuga de água
    {
      ticketId: ticket1Id,
      userId: joaoId,
      content:
        'Encontrei uma poça de água grande na garagem, junto à parede do lado direito. Parece vir de um cano rebentado.',
      createdAt: daysAgo(55),
    },
    {
      ticketId: ticket1Id,
      userId: mariaId,
      content:
        'Obrigada pelo aviso, João. Já contactei a Canalizações Silva para virem ver amanhã de manhã.',
      createdAt: daysAgo(54),
    },
    {
      ticketId: ticket1Id,
      userId: joaoId,
      content: 'O canalizador veio e reparou o cano. A fuga está resolvida. Obrigado pela rapidez!',
      createdAt: daysAgo(50),
    },

    // Ticket 2: Elevador parado
    {
      ticketId: ticket2Id,
      userId: anaId,
      content:
        'O elevador ficou parado quando eu ia para o 3º andar. Os botões não funcionam e a luz interior está a piscar.',
      createdAt: daysAgo(10),
    },
    {
      ticketId: ticket2Id,
      userId: mariaId,
      content:
        'Ana, obrigada por reportar. Já liguei para a ElevaTécnica, o técnico vem amanhã entre as 9h e as 12h.',
      createdAt: daysAgo(9),
    },
    {
      ticketId: ticket2Id,
      userId: sofiaId,
      content:
        'Confirmo que o elevador continua parado. Tive de subir a pé até ao 4º andar com as compras.',
      createdAt: daysAgo(8),
    },

    // Ticket 3: Lâmpada fundida
    {
      ticketId: ticket3Id,
      userId: mariaId,
      content: 'A lâmpada do hall do 2º andar fundiu-se. Vou comprar uma nova este fim de semana.',
      createdAt: daysAgo(5),
    },

    // Ticket 4: Porta da entrada
    {
      ticketId: ticket4Id,
      userId: sofiaId,
      content:
        'A porta principal não tranca. Hoje de manhã encontrei-a completamente aberta quando saí de casa.',
      createdAt: daysAgo(4),
    },
    {
      ticketId: ticket4Id,
      userId: mariaId,
      content:
        'Obrigada, Sofia. Vou pedir um orçamento para reparação da fechadura. Entretanto, peço a todos que puxem bem a porta ao sair.',
      createdAt: daysAgo(3),
    },

    // Ticket 5: Infiltração
    {
      ticketId: ticket5Id,
      userId: mariaId,
      content:
        'Após as chuvas fortes desta semana, surgiram manchas de humidade no teto do 5º andar. Parece ser infiltração pela cobertura.',
      createdAt: daysAgo(30),
    },
    {
      ticketId: ticket5Id,
      userId: joaoId,
      content:
        'Também notei manchas de humidade no teto do meu apartamento no 1º Dir. Pode estar relacionado com a mesma coluna.',
      createdAt: daysAgo(28),
    },

    // Ticket 6: Intercomunicador
    {
      ticketId: ticket6Id,
      userId: joaoId,
      content: 'O meu intercomunicador deixou de funcionar. Quando tocam à porta, não ouço nada.',
      createdAt: daysAgo(40),
    },
    {
      ticketId: ticket6Id,
      userId: mariaId,
      content:
        'João, o eletricista já veio e reparou o intercomunicador. Estava um fio solto na ligação central. Pode verificar se já funciona?',
      createdAt: daysAgo(35),
    },
    {
      ticketId: ticket6Id,
      userId: joaoId,
      content: 'Confirmado, já funciona perfeitamente. Obrigado!',
      createdAt: daysAgo(34),
    },

    // Ticket 7: Pintura das escadas
    {
      ticketId: ticket7Id,
      userId: mariaId,
      content:
        'A pintura da escadaria do 1º ao 3º andar foi concluída pela PintaFácil. O resultado ficou excelente.',
      createdAt: daysAgo(21),
    },

    // Ticket 8: Baratas
    {
      ticketId: ticket8Id,
      userId: anaId,
      content:
        'Ontem à noite vi várias baratas no pátio interior, perto dos caixotes do lixo. É urgente fazer desinfestação.',
      createdAt: daysAgo(3),
    },
    {
      ticketId: ticket8Id,
      userId: sofiaId,
      content:
        'Também vi baratas à entrada da garagem esta manhã. Concordo que devíamos chamar a empresa de desinfestação.',
      createdAt: daysAgo(2),
    },
  ]

  for (const c of commentsData) {
    await db.insert(schema.ticketComments).values({
      id: crypto.randomUUID(),
      orgId,
      ...c,
    })
  }
  console.log(`Created ${commentsData.length} ticket comments`)

  // -------------------------------------------------------------------------
  // 10. Ticket Events (status transitions)
  // -------------------------------------------------------------------------
  const eventsData = [
    // Ticket 1: open → in_progress → resolved
    {
      ticketId: ticket1Id,
      userId: mariaId,
      fromStatus: 'open' as const,
      toStatus: 'in_progress' as const,
      createdAt: daysAgo(54),
    },
    {
      ticketId: ticket1Id,
      userId: mariaId,
      fromStatus: 'in_progress' as const,
      toStatus: 'resolved' as const,
      createdAt: daysAgo(50),
    },

    // Ticket 2: open → in_progress
    {
      ticketId: ticket2Id,
      userId: mariaId,
      fromStatus: 'open' as const,
      toStatus: 'in_progress' as const,
      createdAt: daysAgo(9),
    },

    // Ticket 5: open → in_progress
    {
      ticketId: ticket5Id,
      userId: mariaId,
      fromStatus: 'open' as const,
      toStatus: 'in_progress' as const,
      createdAt: daysAgo(28),
    },

    // Ticket 6: open → in_progress → resolved
    {
      ticketId: ticket6Id,
      userId: mariaId,
      fromStatus: 'open' as const,
      toStatus: 'in_progress' as const,
      createdAt: daysAgo(38),
    },
    {
      ticketId: ticket6Id,
      userId: mariaId,
      fromStatus: 'in_progress' as const,
      toStatus: 'resolved' as const,
      createdAt: daysAgo(34),
    },

    // Ticket 7: open → in_progress → resolved → closed
    {
      ticketId: ticket7Id,
      userId: mariaId,
      fromStatus: 'open' as const,
      toStatus: 'in_progress' as const,
      createdAt: daysAgo(55),
    },
    {
      ticketId: ticket7Id,
      userId: mariaId,
      fromStatus: 'in_progress' as const,
      toStatus: 'resolved' as const,
      createdAt: daysAgo(22),
    },
    {
      ticketId: ticket7Id,
      userId: mariaId,
      fromStatus: 'resolved' as const,
      toStatus: 'closed' as const,
      createdAt: daysAgo(21),
    },
  ]

  for (const e of eventsData) {
    await db.insert(schema.ticketEvents).values({
      id: crypto.randomUUID(),
      orgId,
      ...e,
    })
  }
  console.log(`Created ${eventsData.length} ticket events`)

  // -------------------------------------------------------------------------
  // 11. Maintenance Records
  // -------------------------------------------------------------------------
  const maintenanceData = [
    {
      title: 'Revisão anual do elevador',
      description: 'Revisão anual obrigatória do elevador pelo técnico certificado.',
      cost: '450.00',
      supplierId: supplierElevaTecnicaId,
      performedAt: daysAgo(60),
      createdBy: mariaId,
      createdAt: daysAgo(60),
    },
    {
      title: 'Desentupimento da coluna principal',
      description:
        'Desentupimento da coluna de esgoto principal que estava a causar problemas nos pisos inferiores.',
      cost: '280.00',
      supplierId: supplierSilvaId,
      performedAt: daysAgo(30),
      createdBy: mariaId,
      createdAt: daysAgo(30),
    },
    {
      title: 'Pintura da escadaria (1º ao 3º)',
      description: 'Pintura completa da escadaria do 1º ao 3º andar, incluindo corrimão e rodapés.',
      cost: '1200.00',
      supplierId: supplierPintaFacilId,
      performedAt: daysAgo(21),
      createdBy: mariaId,
      createdAt: daysAgo(21),
    },
  ]

  for (const m of maintenanceData) {
    await db.insert(schema.maintenanceRecords).values({
      id: crypto.randomUUID(),
      orgId,
      ...m,
    })
  }
  console.log(`Created ${maintenanceData.length} maintenance records`)

  // -------------------------------------------------------------------------
  // 12. Notifications (for Maria, all unread)
  // -------------------------------------------------------------------------
  const notificationsData = [
    {
      type: 'ticket_comment',
      title: 'Novo comentário',
      message: 'João Ferreira comentou em "Elevador parado no 3º andar"',
      createdAt: daysAgo(8),
    },
    {
      type: 'association_request',
      title: 'Pedido de associação',
      message: 'Carlos Mendes pediu para se juntar ao condomínio',
      createdAt: daysAgo(7),
    },
    {
      type: 'ticket_status',
      title: 'Estado atualizado',
      message: 'Sofia Costa reportou "Porta da entrada não fecha"',
      createdAt: daysAgo(4),
    },
    {
      type: 'ticket_comment',
      title: 'Novo comentário',
      message: 'Ana Oliveira comentou em "Baratas no pátio interior"',
      createdAt: daysAgo(3),
    },
    {
      type: 'ticket_created',
      title: 'Nova ocorrência',
      message: 'Sofia Costa criou "Porta da entrada não fecha"',
      createdAt: daysAgo(4),
    },
    {
      type: 'maintenance_created',
      title: 'Manutenção registada',
      message: 'Pintura da escadaria concluída',
      createdAt: daysAgo(21),
    },
  ]

  for (const n of notificationsData) {
    await db.insert(schema.notifications).values({
      id: crypto.randomUUID(),
      orgId,
      userId: mariaId,
      readAt: null,
      ...n,
    })
  }
  console.log(`Created ${notificationsData.length} notifications`)

  // -------------------------------------------------------------------------
  // 13. Conversation + Messages (for Maria)
  // -------------------------------------------------------------------------
  await db.insert(schema.conversations).values({
    id: conversationId,
    orgId,
    userId: mariaId,
    title: 'Ocorrências abertas',
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
  })

  const messagesData = [
    {
      role: 'user' as const,
      content: 'Quais as ocorrências abertas esta semana?',
      createdAt: hoursAgo(2),
    },
    {
      role: 'assistant' as const,
      content:
        'Existem 3 ocorrências abertas no Edifício São Tomé:\n\n1. **Lâmpada fundida no hall do 2º** — prioridade baixa, reportada por si\n2. **Porta da entrada não fecha** — prioridade média, reportada por Sofia Costa\n3. **Baratas no pátio interior** — prioridade média, reportada por Ana Oliveira\n\nDeseja mais detalhes sobre alguma delas?',
      createdAt: hoursAgo(2),
    },
    {
      role: 'user' as const,
      content: 'Qual o prestador de elevadores?',
      createdAt: hoursAgo(1),
    },
    {
      role: 'assistant' as const,
      content:
        'O prestador registado para elevadores é a **ElevaTécnica**.\n\n- **Contacto:** Rui Marques\n- **Telefone:** 913 456 789\n- **E-mail:** info@elevatecnica.pt\n\nAtualmente existe uma ocorrência em curso: "Elevador parado no 3º andar" (prioridade alta).',
      createdAt: hoursAgo(1),
    },
  ]

  for (const msg of messagesData) {
    await db.insert(schema.conversationMessages).values({
      id: crypto.randomUUID(),
      conversationId,
      ...msg,
    })
  }
  console.log(`Created 1 conversation with ${messagesData.length} messages`)

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n--- Seed Demo Summary ---')
  console.log(`Organization: Edifício São Tomé (${orgId})`)
  console.log(`Users: ${users.length}`)
  console.log(`  - Maria Santos (admin@zelus.sh) — org admin`)
  console.log(`  - João Ferreira — fraction_owner_admin, 1º Dir.`)
  console.log(`  - Ana Oliveira — fraction_member, 3º Esq.`)
  console.log(`  - Carlos Mendes — fraction_member, R/C Dir. (pending)`)
  console.log(`  - Sofia Costa — fraction_owner_admin, 4º Dir.`)
  console.log(`Fractions: ${fractionLabels.length}`)
  console.log(`Categories: ${categoryKeys.length}`)
  console.log(`Suppliers: ${suppliersData.length}`)
  console.log(`Tickets: ${ticketsData.length}`)
  console.log(`Comments: ${commentsData.length}`)
  console.log(`Events: ${eventsData.length}`)
  console.log(`Maintenance records: ${maintenanceData.length}`)
  console.log(`Notifications: ${notificationsData.length}`)
  console.log(`Conversations: 1 (${messagesData.length} messages)`)
  console.log('\nDemo seed complete.')
}

seedDemo()
  .catch((err) => {
    console.error('Demo seed failed:', err)
    process.exit(1)
  })
  .finally(() => {
    client.end()
  })
