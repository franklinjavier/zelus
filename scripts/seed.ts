/**
 * Seed script — creates a demo organization, admin user, and fractions.
 *
 * Usage: bun run db:seed
 */
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

async function seed() {
  console.log('Seeding database...')

  // 1. Create demo admin user
  const userId = crypto.randomUUID()
  const now = new Date()

  await db.insert(schema.user).values({
    id: userId,
    name: 'Admin Demo',
    email: 'admin@zelus.sh',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })

  // 2. Create credential account (password: "password123")
  // In production, Better Auth handles password hashing. This is for seed only.
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: 'credential',
    userId,
    password:
      '7b88cfe451278866064befa67491a685:771d43f1f39ddfd1d0b7ad6a984b3a90e6fd79806259ba665612f3b913cfb97e54ec9c33c6bc957252440b0fd96eca0528a2e0326a14d82e027120e7b7e6b165',
    createdAt: now,
    updatedAt: now,
  })

  // 3. Create demo organization
  const orgId = crypto.randomUUID()

  await db.insert(schema.organization).values({
    id: orgId,
    name: 'Condomínio Azulejo',
    slug: 'condominio-azulejo',
    city: 'Lisboa',
    totalFractions: '12',
    notes: 'Demo condominium for development',
    language: 'pt-PT',
    timezone: 'Europe/Lisbon',
    createdAt: now,
    metadata: null,
    logo: null,
  })

  // 4. Add user as org_admin member
  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: 'admin',
    createdAt: now,
  })

  // 5. Create demo fractions
  const fractionLabels = [
    'T1 – R/C Esq.',
    'T1 – R/C Dir.',
    'T2 – 1º Esq.',
    'T2 – 1º Dir.',
    'T3 – 2º Esq.',
    'T3 – 2º Dir.',
    'T2 – 3º Esq.',
    'T2 – 3º Dir.',
    'T4 – 4º Esq.',
    'T4 – 4º Dir.',
    'T1 – 5º Esq.',
    'T1 – 5º Dir.',
  ]

  for (const label of fractionLabels) {
    await db.insert(schema.fractions).values({
      id: crypto.randomUUID(),
      orgId,
      label,
    })
  }

  // 6. Seed categories
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
  console.log(`Created user: admin@zelus.sh (id: ${userId})`)
  console.log(`Created org: Condomínio Azulejo (id: ${orgId})`)
  console.log(`Created ${fractionLabels.length} fractions`)
  console.log('Seed complete.')
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => {
    client.end()
  })
