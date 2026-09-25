import { type StoredMessage, toStoredMessages } from '~/lib/ai/chat-history'
import type { ChatHistoryRepository } from '../repositories/chat-history-repository'

/** Saved chats are kept for 90 days after their last change (spec §6.2, §9.3). */
export const CHAT_RETENTION_DAYS = 90

type Deps = Readonly<{ repo: ChatHistoryRepository; clock: () => Date }>

const retentionCutoff = (now: Date) => new Date(now.getTime() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000)

export const loadChatHistory = async ({ repo, clock }: Deps, ownerKey: string): Promise<StoredMessage[]> =>
  (await repo.find(ownerKey, retentionCutoff(clock()))) ?? []

/** Replaces the owner's chat. Attachments keep only their file name. Expired chats are purged. */
export const saveChatHistory = async (
  { repo, clock }: Deps,
  ownerKey: string,
  messages: ReadonlyArray<StoredMessage>,
): Promise<void> => {
  const now = clock()
  await repo.purgeUpdatedBefore(retentionCutoff(now))
  if (messages.length === 0) await repo.remove(ownerKey)
  else await repo.save(ownerKey, toStoredMessages(messages), now)
}

export const clearChatHistory = async ({ repo, clock }: Deps, ownerKey: string): Promise<void> => {
  await repo.purgeUpdatedBefore(retentionCutoff(clock()))
  await repo.remove(ownerKey)
}
