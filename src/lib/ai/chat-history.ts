import { z } from 'zod'
import { attachmentName, workSpecPlaceholder } from '~/lib/ai/work-spec'

export const MAX_STORED_MESSAGES = 200
const MAX_PARTS_PER_MESSAGE = 200
const MAX_STORED_CHAT_CHARS = 1024 * 1024

const StoredPart = z.object({ type: z.string().min(1).max(40) }).catchall(z.json())

export const StoredMessage = z.strictObject({
  id: z.string().min(1).max(100),
  role: z.enum(['user', 'assistant']),
  parts: z.array(StoredPart).max(MAX_PARTS_PER_MESSAGE),
})
export type StoredMessage = z.infer<typeof StoredMessage>

/** A saved conversation: what the chat widget shows and sends back to the model after a reload. */
export const StoredChat = z
  .array(StoredMessage)
  .max(MAX_STORED_MESSAGES)
  .refine((messages) => JSON.stringify(messages).length <= MAX_STORED_CHAT_CHARS, {
    message: 'The chat is too large to save',
  })

type ChatMessage = Readonly<{
  id: string
  role: 'system' | 'user' | 'assistant'
  parts: ReadonlyArray<Readonly<{ type: string }>>
}>

const toStoredPart = (part: Readonly<{ type: string }>) => {
  const name = attachmentName(part)
  return name === null ? part : workSpecPlaceholder(name)
}

const chatChars = (sizes: ReadonlyArray<number>) =>
  sizes.reduce((sum, size) => sum + size, 2) + Math.max(sizes.length - 1, 0)

/** The newest messages that fit the storage limits, so a long chat keeps saving. */
const newestThatFit = (messages: StoredMessage[]): StoredMessage[] => {
  const kept = messages.slice(-MAX_STORED_MESSAGES)
  const sizes = kept.map((message) => JSON.stringify(message).length)
  let first = 0
  while (first < kept.length && chatChars(sizes.slice(first)) > MAX_STORED_CHAT_CHARS) first++
  return kept.slice(first)
}

/**
 * The messages as they are saved: attachments are replaced by a placeholder that keeps only the
 * file name, system and empty messages are dropped, each message keeps only its id, role and
 * parts, and the oldest messages are dropped when the chat is over the storage limits.
 */
export const toStoredMessages = (messages: ReadonlyArray<ChatMessage>): StoredMessage[] =>
  newestThatFit(
    messages.flatMap(({ id, role, parts }) =>
      role === 'system' || parts.length === 0 ? [] : [{ id, role, parts: parts.map(toStoredPart) }],
    ),
  )
