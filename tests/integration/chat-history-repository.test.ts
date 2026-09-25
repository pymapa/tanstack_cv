import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assistantChat } from '~/db/schema'
import type { StoredMessage } from '~/lib/ai/chat-history'
import { createPgChatHistoryRepository } from '~/server/repositories/pg-chat-history-repository'
import { createTestDb, type TestDb } from '../fixtures/db'

const hello: StoredMessage = { id: 'm1', role: 'user', parts: [{ type: 'text', content: 'Hello' }] }
const reply: StoredMessage = { id: 'a1', role: 'assistant', parts: [{ type: 'text', content: 'Hi there' }] }
const jan = (day: number) => new Date(Date.UTC(2026, 0, day))

describe('Postgres chat history repository', () => {
  let testDb: TestDb
  const repo = () => createPgChatHistoryRepository(testDb.db, () => '0190a000-0000-7000-8000-000000000001')

  beforeAll(async () => {
    testDb = await createTestDb()
  })

  afterAll(async () => {
    await testDb.drop()
  })

  beforeEach(async () => {
    await testDb.db.delete(assistantChat)
  })

  it('should return null when the owner has no chat', async () => {
    const found = await repo().find('owner-a', jan(1))

    expect(found).toBeNull()
  })

  it('should return the saved messages in order', async () => {
    await repo().save('owner-a', [hello, reply], jan(2))

    const found = await repo().find('owner-a', jan(1))

    expect(found).toEqual([hello, reply])
  })

  it('should replace the chat when the owner saves again', async () => {
    await repo().save('owner-a', [hello], jan(2))

    await repo().save('owner-a', [hello, reply], jan(3))

    expect(await repo().find('owner-a', jan(1))).toEqual([hello, reply])
    expect(await testDb.db.select().from(assistantChat)).toHaveLength(1)
  })

  it('should return null when the chat was last saved before the given time', async () => {
    await repo().save('owner-a', [hello], jan(2))

    const found = await repo().find('owner-a', jan(3))

    expect(found).toBeNull()
  })

  it('should delete only the owner chat on remove', async () => {
    await repo().save('owner-a', [hello], jan(2))
    await createPgChatHistoryRepository(testDb.db, () => '0190a000-0000-7000-8000-000000000002').save(
      'owner-b',
      [hello],
      jan(2),
    )

    await repo().remove('owner-a')

    expect(await repo().find('owner-a', jan(1))).toBeNull()
    expect(await repo().find('owner-b', jan(1))).toEqual([hello])
  })

  it('should purge chats last saved before the cutoff and keep the rest', async () => {
    await repo().save('old', [hello], jan(1))
    await createPgChatHistoryRepository(testDb.db, () => '0190a000-0000-7000-8000-000000000002').save(
      'recent',
      [hello],
      jan(5),
    )

    await repo().purgeUpdatedBefore(jan(3))

    const owners = (await testDb.db.select().from(assistantChat)).map((row) => row.ownerKey)
    expect(owners).toEqual(['recent'])
  })
})
