import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

export const fractions = pgTable(
  'fractions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    label: text('label').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('fractions_org_id_idx').on(t.orgId),
    uniqueIndex('fractions_org_id_label_idx').on(t.orgId, t.label),
  ],
)

export const userFractions = pgTable(
  'user_fractions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    fractionId: text('fraction_id')
      .notNull()
      .references(() => fractions.id),
    role: text('role', { enum: ['fraction_owner_admin', 'fraction_member'] }).notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    invitedBy: text('invited_by').references(() => user.id),
    approvedBy: text('approved_by').references(() => user.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('user_fractions_org_user_idx').on(t.orgId, t.userId),
    index('user_fractions_org_fraction_idx').on(t.orgId, t.fractionId),
    index('user_fractions_org_status_idx').on(t.orgId, t.status),
  ],
)
