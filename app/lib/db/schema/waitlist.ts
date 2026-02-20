import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const waitlistLeads = pgTable(
  'waitlist_leads',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('waitlist_leads_email_idx').on(t.email)],
)
