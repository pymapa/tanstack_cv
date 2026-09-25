import { describe, expect, it } from 'vitest'
import { CHAT_OWNER_COOKIE, chatOwnerCookieOptions, parseChatOwnerKey } from '~/server/chat-owner'

describe('parseChatOwnerKey', () => {
  it('should accept a UUID', () => {
    expect(parseChatOwnerKey('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7')
  })

  it.each([undefined, '', 'owner-a', 'a'.repeat(36), "7c9e6679-7425-40de-944b-e07fc1f90ae7' OR 1=1"])(
    'should reject %j',
    (value) => {
      expect(parseChatOwnerKey(value)).toBeNull()
    },
  )
})

describe('chatOwnerCookieOptions', () => {
  it('should make the cookie unreadable by scripts and limited to same-site requests', () => {
    const options = chatOwnerCookieOptions('http://localhost:3000/_serverFn/x')

    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('should keep the cookie for the 90-day retention period', () => {
    expect(chatOwnerCookieOptions('http://localhost:3000/').maxAge).toBe(90 * 24 * 60 * 60)
  })

  it('should mark the cookie Secure on HTTPS only', () => {
    expect(chatOwnerCookieOptions('https://cv.example.test/').secure).toBe(true)
    expect(chatOwnerCookieOptions('http://localhost:3000/').secure).toBe(false)
  })

  it('should use a name that says what the cookie is for', () => {
    expect(CHAT_OWNER_COOKIE).toBe('cv_chat_owner')
  })
})
