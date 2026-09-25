import { describe, expect, it } from 'vitest'
import { endedBeforeAnswer, withoutRepeatedToolCalls } from '~/lib/ai/chat-parts'

const call = (id: string, name: string) => ({ type: 'tool-call', id, name })
const result = (toolCallId: string) => ({ type: 'tool-result', toolCallId })
const text = (content: string) => ({ type: 'text', content })

const ids = (parts: ReadonlyArray<{ id?: string; content?: string; toolCallId?: string }>) =>
  parts.map((p) => p.id ?? p.content)

describe('withoutRepeatedToolCalls', () => {
  it('should keep one tool call when the same tool is called several times in a row', () => {
    const parts = [call('1', 'searchPeople'), call('2', 'searchPeople'), call('3', 'searchPeople')]

    expect(ids(withoutRepeatedToolCalls(parts))).toEqual(['1'])
  })

  it('should keep a call to a different tool', () => {
    const parts = [call('1', 'searchPeople'), call('2', 'searchPeople'), call('3', 'getCv'), call('4', 'getCv')]

    expect(ids(withoutRepeatedToolCalls(parts))).toEqual(['1', '3'])
  })

  it('should treat calls separated only by tool results as a row', () => {
    const parts = [call('1', 'searchPeople'), result('1'), call('2', 'searchPeople'), result('2')]

    expect(ids(withoutRepeatedToolCalls(parts).filter((p) => p.type === 'tool-call'))).toEqual(['1'])
  })

  it('should show the tool again after the assistant has written text in between', () => {
    const parts = [call('1', 'searchPeople'), text('Found a few.'), call('2', 'searchPeople')]

    expect(ids(withoutRepeatedToolCalls(parts))).toEqual(['1', 'Found a few.', '2'])
  })
})

describe('endedBeforeAnswer', () => {
  const user = { role: 'user', parts: [{ type: 'text', content: 'Fill in my CV' }] }

  it('should be true when the last answer stops at a tool call', () => {
    const messages = [
      user,
      {
        role: 'assistant',
        parts: [
          { type: 'text', content: 'Reading.' },
          { type: 'tool-call', name: 'readDraft' },
        ],
      },
    ]

    expect(endedBeforeAnswer(messages)).toBe(true)
  })

  it('should be false when text follows the last tool call', () => {
    const messages = [
      user,
      {
        role: 'assistant',
        parts: [{ type: 'tool-call', name: 'readDraft' }, { type: 'tool-result' }, { type: 'text', content: 'Done.' }],
      },
    ]

    expect(endedBeforeAnswer(messages)).toBe(false)
  })

  it('should be false before the assistant has answered', () => {
    expect(endedBeforeAnswer([user])).toBe(false)
    expect(endedBeforeAnswer([])).toBe(false)
  })
})
