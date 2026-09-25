import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestUrl, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getDb } from '~/db/client'
import { StoredChat, type StoredMessage } from '~/lib/ai/chat-history'
import { uuidv7 } from '~/lib/id'
import { CHAT_OWNER_COOKIE, chatOwnerCookieOptions, parseChatOwnerKey } from '../chat-owner'
import { createPgChatHistoryRepository } from '../repositories/pg-chat-history-repository'
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../services/chat-history'

/*
 * SECURITY TODO (spec M2): like the rest of the app, these have no sign-in yet. A chat belongs
 * to the browser that holds the owner cookie. With sign-in, use the user id as the owner key.
 */

const deps = () => ({ repo: createPgChatHistoryRepository(getDb(), () => uuidv7()), clock: () => new Date() })

const ownerKey = () => parseChatOwnerKey(getCookie(CHAT_OWNER_COOKIE))

export const getChatHistoryFn = createServerFn({ method: 'GET' }).handler(async (): Promise<StoredMessage[]> => {
  const owner = ownerKey()
  return owner === null ? [] : loadChatHistory(deps(), owner)
})

export const saveChatHistoryFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ messages: StoredChat }))
  .handler(async ({ data }): Promise<void> => {
    const owner = ownerKey() ?? crypto.randomUUID()
    // Set on every save, so the cookie lasts as long as the chat it points to.
    setCookie(CHAT_OWNER_COOKIE, owner, chatOwnerCookieOptions(getRequestUrl().href))
    await saveChatHistory(deps(), owner, data.messages)
  })

export const clearChatHistoryFn = createServerFn({ method: 'POST' }).handler(async (): Promise<void> => {
  const owner = ownerKey()
  if (owner !== null) await clearChatHistory(deps(), owner)
})
