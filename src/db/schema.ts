/**
 * Drizzle tables (spec §6.2). Migrations in `src/db/migrations/` are generated from this file
 * with `pnpm db:generate`; never change the database by hand.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { StoredMessage } from '~/lib/ai/chat-history'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}

/**
 * The CV assistant's saved chat: one row per owner, replaced on every save. Attachments are
 * stored as file-name placeholders only. Rows untouched for 90 days are purged (spec §9.3).
 */
export const assistantChat = pgTable(
  'assistant_chat',
  {
    id: uuid('id').primaryKey(),
    /** A random per-browser id until sign-in exists (spec M2), then the user id. */
    ownerKey: text('owner_key').notNull().unique(),
    messages: jsonb('messages').$type<StoredMessage[]>().notNull(),
    ...timestamps,
  },
  // The retention purge deletes by last change.
  (table) => [index('assistant_chat_updated_at_idx').on(table.updatedAt)],
)
