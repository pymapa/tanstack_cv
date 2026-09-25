import { describe, expect, it } from 'vitest'
import { MAX_STORED_MESSAGES, StoredChat, toStoredMessages } from '~/lib/ai/chat-history'

const placeholder = (filename: string) =>
  `<work_spec filename="${filename}">\n(The file is not kept in the saved chat.)\n</work_spec>`

const userMessage = (parts: ReadonlyArray<{ type: string } & Record<string, unknown>>) => ({
  id: 'm1',
  role: 'user' as const,
  parts,
})

describe('toStoredMessages', () => {
  it('should replace a PDF document part with a placeholder that names the file', () => {
    const pdf = {
      type: 'document',
      source: { type: 'data', value: 'JVBERi0xLjc=', mimeType: 'application/pdf' },
      metadata: { filename: 'spec.pdf' },
    }

    const stored = toStoredMessages([userMessage([pdf, { type: 'text', content: 'Who fits?' }])])

    expect(stored[0]?.parts).toEqual([
      { type: 'text', content: placeholder('spec.pdf') },
      { type: 'text', content: 'Who fits?' },
    ])
  })

  it('should replace the content of a text work spec with a placeholder', () => {
    const spec = { type: 'text', content: '<work_spec filename="need.md">\nSenior React developer\n</work_spec>' }

    const stored = toStoredMessages([userMessage([spec])])

    expect(stored[0]?.parts).toEqual([{ type: 'text', content: placeholder('need.md') }])
  })

  it('should name an unnamed document "Document"', () => {
    const pdf = { type: 'document', source: { type: 'data', value: 'JVBERi0=', mimeType: 'application/pdf' } }

    const stored = toStoredMessages([userMessage([pdf])])

    expect(stored[0]?.parts).toEqual([{ type: 'text', content: placeholder('Document') }])
  })

  it('should keep text, tool call and tool result parts unchanged', () => {
    const parts = [
      { type: 'text', content: 'Here are two people.' },
      { type: 'tool-call', id: 't1', name: 'searchPeople', arguments: '{"q":"react"}', state: 'input-complete' },
      { type: 'tool-result', toolCallId: 't1', content: '[]', state: 'complete' },
    ]

    const stored = toStoredMessages([{ id: 'a1', role: 'assistant', parts }])

    expect(stored).toEqual([{ id: 'a1', role: 'assistant', parts }])
  })

  it('should drop system messages and every field except id, role and parts', () => {
    const messages = [
      { id: 's1', role: 'system' as const, parts: [{ type: 'text', content: 'Be brief.' }] },
      { ...userMessage([{ type: 'text', content: 'Hi' }]), createdAt: new Date('2026-01-01'), metadata: { a: 1 } },
    ]

    const stored = toStoredMessages(messages)

    expect(stored).toEqual([{ id: 'm1', role: 'user', parts: [{ type: 'text', content: 'Hi' }] }])
  })

  it('should drop messages without parts, such as an answer that failed before it started', () => {
    const messages = [
      userMessage([{ type: 'text', content: 'Hi' }]),
      { id: 'a1', role: 'assistant' as const, parts: [] },
    ]

    const stored = toStoredMessages(messages)

    expect(stored).toEqual([{ id: 'm1', role: 'user', parts: [{ type: 'text', content: 'Hi' }] }])
  })
})

describe('StoredChat', () => {
  const message = (id: string) => ({ id, role: 'user', parts: [{ type: 'text', content: 'Hi' }] })

  it('should accept stored messages', () => {
    const result = StoredChat.safeParse([message('m1'), { ...message('a1'), role: 'assistant' }])

    expect(result.success).toBe(true)
  })

  it('should reject more messages than the limit', () => {
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 1 }, (_, i) => message(`m${i}`))

    const result = StoredChat.safeParse(messages)

    expect(result.success).toBe(false)
  })

  it('should reject a system message', () => {
    const result = StoredChat.safeParse([{ ...message('s1'), role: 'system' }])

    expect(result.success).toBe(false)
  })

  it('should reject a part without a type', () => {
    const result = StoredChat.safeParse([{ ...message('m1'), parts: [{ content: 'Hi' }] }])

    expect(result.success).toBe(false)
  })

  it('should reject a chat larger than 1 MB', () => {
    const big = { ...message('m1'), parts: [{ type: 'text', content: 'x'.repeat(1024 * 1024) }] }

    const result = StoredChat.safeParse([big])

    expect(result.success).toBe(false)
  })
})

describe('toStoredMessages limits', () => {
  const message = (i: number) => ({
    id: `m${i}`,
    role: 'user' as const,
    parts: [{ type: 'text', content: `Question ${i}` }],
  })

  it('should keep the newest messages when there are more than the limit', () => {
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 5 }, (_, i) => message(i))

    const stored = toStoredMessages(messages)

    expect(stored).toHaveLength(MAX_STORED_MESSAGES)
    expect(stored.at(-1)?.id).toBe(`m${MAX_STORED_MESSAGES + 4}`)
    expect(StoredChat.safeParse(stored).success).toBe(true)
  })

  it('should drop the oldest messages until the chat fits in 1 MB', () => {
    const big = (i: number) => ({ ...message(i), parts: [{ type: 'text', content: 'x'.repeat(400 * 1024) }] })

    const stored = toStoredMessages([big(1), big(2), big(3), message(4)])

    expect(stored.map((m) => m.id)).toEqual(['m2', 'm3', 'm4'])
    expect(StoredChat.safeParse(stored).success).toBe(true)
  })
})
