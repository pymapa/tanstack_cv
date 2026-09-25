import { describe, expect, it } from 'vitest'
import type { StoredMessage } from '~/lib/ai/chat-history'
import type { ChatHistoryRepository } from '~/server/repositories/chat-history-repository'
import { clearChatHistory, loadChatHistory, saveChatHistory } from '~/server/services/chat-history'

type Row = { messages: StoredMessage[]; updatedAt: Date }

/** In-memory stand-in for the Postgres repository, with the same semantics. */
const fakeRepository = () => {
  const rows = new Map<string, Row>()
  const repo: ChatHistoryRepository = {
    find: (ownerKey, updatedSince) => {
      const row = rows.get(ownerKey)
      return Promise.resolve(row && row.updatedAt >= updatedSince ? row.messages : null)
    },
    save: (ownerKey, messages, now) => {
      rows.set(ownerKey, { messages, updatedAt: now })
      return Promise.resolve()
    },
    remove: (ownerKey) => {
      rows.delete(ownerKey)
      return Promise.resolve()
    },
    purgeUpdatedBefore: (cutoff) => {
      for (const [key, row] of rows) if (row.updatedAt < cutoff) rows.delete(key)
      return Promise.resolve()
    },
  }
  return { repo, rows }
}

const day = 24 * 60 * 60 * 1000
const start = new Date('2026-01-01T00:00:00Z')
const at = (days: number) => () => new Date(start.getTime() + days * day)

const hello: StoredMessage = { id: 'm1', role: 'user', parts: [{ type: 'text', content: 'Hello' }] }

describe('chat history service', () => {
  it('should return no messages when nothing was saved', async () => {
    const { repo } = fakeRepository()

    const messages = await loadChatHistory({ repo, clock: at(0) }, 'owner-a')

    expect(messages).toEqual([])
  })

  it('should return the saved messages to the same owner only', async () => {
    const { repo } = fakeRepository()
    await saveChatHistory({ repo, clock: at(0) }, 'owner-a', [hello])

    const own = await loadChatHistory({ repo, clock: at(1) }, 'owner-a')
    const other = await loadChatHistory({ repo, clock: at(1) }, 'owner-b')

    expect(own).toEqual([hello])
    expect(other).toEqual([])
  })

  it('should save attachments as placeholders, not their content', async () => {
    const { repo, rows } = fakeRepository()
    const pdf = { type: 'document', source: { type: 'data', value: 'JVBERi0=' }, metadata: { filename: 'spec.pdf' } }

    await saveChatHistory({ repo, clock: at(0) }, 'owner-a', [{ ...hello, parts: [pdf] }])

    expect(JSON.stringify(rows.get('owner-a'))).not.toContain('JVBERi0=')
  })

  it('should not return a chat last saved more than 90 days ago', async () => {
    const { repo } = fakeRepository()
    await saveChatHistory({ repo, clock: at(0) }, 'owner-a', [hello])

    const messages = await loadChatHistory({ repo, clock: at(91) }, 'owner-a')

    expect(messages).toEqual([])
  })

  it('should delete every chat last saved more than 90 days ago when a chat is saved', async () => {
    const { repo, rows } = fakeRepository()
    await saveChatHistory({ repo, clock: at(0) }, 'old', [hello])
    await saveChatHistory({ repo, clock: at(10) }, 'recent', [hello])

    await saveChatHistory({ repo, clock: at(91) }, 'owner-a', [hello])

    expect([...rows.keys()].sort()).toEqual(['owner-a', 'recent'])
  })

  it('should delete the chat when an empty chat is saved', async () => {
    const { repo, rows } = fakeRepository()
    await saveChatHistory({ repo, clock: at(0) }, 'owner-a', [hello])

    await saveChatHistory({ repo, clock: at(1) }, 'owner-a', [])

    expect(rows.has('owner-a')).toBe(false)
  })

  it('should delete the owner chat and expired chats when the history is cleared', async () => {
    const { repo, rows } = fakeRepository()
    await saveChatHistory({ repo, clock: at(0) }, 'old', [hello])
    await saveChatHistory({ repo, clock: at(90) }, 'owner-a', [hello])
    await saveChatHistory({ repo, clock: at(90) }, 'owner-b', [hello])

    await clearChatHistory({ repo, clock: at(91) }, 'owner-a')

    expect([...rows.keys()]).toEqual(['owner-b'])
  })
})
