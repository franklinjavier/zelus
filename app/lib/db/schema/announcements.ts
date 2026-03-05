import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

export const announcements = pgTable(
  'announcements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    eventDate: timestamp('event_date').notNull(),
    recurrence: jsonb('recurrence'),
    pausedAt: timestamp('paused_at'),
    archivedAt: timestamp('archived_at'),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('announcements_org_idx').on(t.orgId)],
)
