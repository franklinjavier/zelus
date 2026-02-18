import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

export const conversations = pgTable(
  'conversations',
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
    title: text('title'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('conversations_org_user_idx').on(t.orgId, t.userId)],
)

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    toolCalls: jsonb('tool_calls'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('conversation_messages_conv_idx').on(t.conversationId)],
)
