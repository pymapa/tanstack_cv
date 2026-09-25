import { z } from 'zod'
import { CHAT_RETENTION_DAYS } from './services/chat-history'

/**
 * Until sign-in exists (spec M2), a saved chat belongs to a browser: a random UUID in an
 * HttpOnly cookie. With sign-in, the owner key becomes the user id.
 */
export const CHAT_OWNER_COOKIE = 'cv_chat_owner'

const OwnerKey = z.uuid()

export const parseChatOwnerKey = (value: string | undefined): string | null => {
  const parsed = OwnerKey.safeParse(value)
  return parsed.success ? parsed.data : null
}

export const chatOwnerCookieOptions = (requestUrl: string) =>
  ({
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: new URL(requestUrl).protocol === 'https:',
    maxAge: CHAT_RETENTION_DAYS * 24 * 60 * 60,
  }) as const
