import { and, eq, gte, lt } from 'drizzle-orm'
import type { Db } from '~/db/client'
import { assistantChat } from '~/db/schema'
import type { ChatHistoryRepository } from './chat-history-repository'

export const createPgChatHistoryRepository = (db: Db, idGen: () => string): ChatHistoryRepository => ({
  find: async (ownerKey, updatedSince) => {
    const [row] = await db
      .select({ messages: assistantChat.messages })
      .from(assistantChat)
      .where(and(eq(assistantChat.ownerKey, ownerKey), gte(assistantChat.updatedAt, updatedSince)))
    return row?.messages ?? null
  },
  save: async (ownerKey, messages, now) => {
    await db
      .insert(assistantChat)
      .values({ id: idGen(), ownerKey, messages, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: assistantChat.ownerKey, set: { messages, updatedAt: now } })
  },
  remove: async (ownerKey) => {
    await db.delete(assistantChat).where(eq(assistantChat.ownerKey, ownerKey))
  },
  purgeUpdatedBefore: async (cutoff) => {
    await db.delete(assistantChat).where(lt(assistantChat.updatedAt, cutoff))
  },
})
