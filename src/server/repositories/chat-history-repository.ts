import type { StoredMessage } from '~/lib/ai/chat-history'

/**
 * Storage port for the CV assistant's saved chats: one chat per owner. The owner key is a
 * random per-browser id until sign-in exists (spec M2), then the user id.
 */
export type ChatHistoryRepository = Readonly<{
  /** The owner's chat, or null when there is none or it was last saved before `updatedSince`. */
  find: (ownerKey: string, updatedSince: Date) => Promise<StoredMessage[] | null>
  /** Creates or replaces the owner's chat. */
  save: (ownerKey: string, messages: StoredMessage[], now: Date) => Promise<void>
  remove: (ownerKey: string) => Promise<void>
  /** Deletes every chat last saved before `cutoff`. */
  purgeUpdatedBefore: (cutoff: Date) => Promise<void>
}>
