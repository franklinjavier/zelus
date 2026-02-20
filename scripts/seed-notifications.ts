/**
 * Seed test notifications for the demo user.
 *
 * Usage: bun run dotenv -e .env.local -- bun run scripts/seed-notifications.ts
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

async function main() {
  // Find the demo user and org
  const [demoUser] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, 'admin@zelus.sh'))
    .limit(1)

  if (!demoUser) {
    console.error('Demo user not found. Run bun run db:seed first.')
    process.exit(1)
  }

  const [membership] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, demoUser.id))
    .limit(1)

  if (!membership) {
    console.error('Demo user has no org membership.')
    process.exit(1)
  }

  const orgId = membership.organizationId

  const notifications = [
    {
      type: 'ticket_update',
      title: 'Ocorrência atualizada — Fuga de água no 3º andar',
      message: 'O estado foi alterado para "em progresso".',
      metadata: {},
    },
    {
      type: 'association_approved',
      title: 'Associação aprovada — T3 – 2º Esq.',
      message: 'A sua associação à fração T3 – 2º Esq. foi aprovada.',
      metadata: {},
    },
    {
      type: 'ticket_comment',
      title: 'Novo comentário — Elevador avariado',
      message: 'João Silva adicionou um comentário.',
      metadata: {},
    },
    {
      type: 'ticket_update',
      title: 'Ocorrência resolvida — Porta da garagem',
      message: 'O estado foi alterado para "resolvido".',
      metadata: {},
    },
    {
      type: 'association_rejected',
      title: 'Associação rejeitada — T1 – R/C Dir.',
      message: 'A sua associação à fração T1 – R/C Dir. foi rejeitada.',
      metadata: {},
      readAt: new Date(), // This one is already read
    },
  ]

  for (const n of notifications) {
    await db.insert(schema.notifications).values({
      orgId,
      userId: demoUser.id,
      type: n.type,
      title: n.title,
      message: n.message,
      metadata: n.metadata,
      readAt: 'readAt' in n ? (n.readAt as Date) : null,
    })
  }

  console.log(`Created ${notifications.length} test notifications for ${demoUser.email}`)
  console.log('Visit /notifications to see them.')
}

main()
  .catch((err) => {
    console.error('Failed:', err)
    process.exit(1)
  })
  .finally(() => {
    client.end()
  })
